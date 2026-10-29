"""Wanzhi application OpenAPI client, intentionally no equipment/tool execution."""
from dataclasses import dataclass
import json
import re
import time
from urllib import error, parse, request

from .wanzhi_config import BASE_URL
from .wanzhi_contract import ContractError, strict_json, validate_decision

MAX_BYTES = 2 * 1024 * 1024
MAX_LINE = 65536


class ProviderError(RuntimeError):
    def __init__(self, code, uncertain=False):
        super().__init__(code)
        self.code, self.uncertain = code, uncertain


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward bearer credentials to an unverified redirect target.
        return None


def redact(value, secret=''):
    text = str(value)
    if secret:
        text = text.replace(secret, '[REDACTED]')
    return re.sub(r'sk-[A-Za-z0-9_-]{8,}', '[REDACTED]', text)


def _read_json(response):
    body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ProviderError('RESPONSE_TOO_LARGE')
    try:
        return strict_json(body.decode('utf-8-sig'))
    except (UnicodeError, ContractError):
        raise ProviderError('INVALID_PROVIDER_JSON') from None


def business_data(payload):
    if not isinstance(payload, dict) or type(payload.get('code')) is not int:
        raise ProviderError('UNKNOWN_PROVIDER_ENVELOPE')
    if payload['code'] != 200:
        raise ProviderError('PROVIDER_BUSINESS_ERROR')
    return payload.get('data')


def read_sse(response, total_timeout=180):
    """SSE framing: BOM, CRLF, multiline data, bounded lines and total payload."""
    started, count, first = time.monotonic(), 0, True
    event, data, event_id = 'message', [], ''
    while True:
        if time.monotonic() - started > total_timeout:
            raise ProviderError('STREAM_DEADLINE', uncertain=True)
        line = response.readline(MAX_LINE + 1)
        count += len(line)
        if len(line) > MAX_LINE or count > MAX_BYTES:
            raise ProviderError('STREAM_TOO_LARGE', uncertain=True)
        if not line:
            # An incomplete last frame is not a completed event.
            if data:
                raise ProviderError('TRUNCATED_SSE_FRAME', uncertain=True)
            break
        try:
            text = line.decode('utf-8-sig' if first else 'utf-8').rstrip('\r\n')
        except UnicodeError:
            raise ProviderError('INVALID_STREAM_ENCODING', uncertain=True) from None
        first = False
        if text == '':
            if data:
                yield {'event': event, 'id': event_id, 'data': '\n'.join(data)}
            event, data, event_id = 'message', [], ''
        elif not text.startswith(':'):
            name, _, value = text.partition(':')
            value = value[1:] if value.startswith(' ') else value
            if name == 'data':
                data.append(value)
            elif name == 'event':
                event = value
            elif name == 'id':
                event_id = value


@dataclass
class StreamReceipt:
    event_types: list
    completion_confirmed: bool
    frame_count: int


class WanzhiClient:
    def __init__(self, settings, opener=None, timeout=30):
        self.settings = settings
        self.opener = opener or request.build_opener(NoRedirect())
        self.timeout = timeout

    def _open(self, method, path, payload=None):
        if not self.settings.api_key:
            raise ProviderError('KEY_NOT_CONFIGURED')
        body = None if payload is None else json.dumps(payload, ensure_ascii=False, allow_nan=False).encode('utf-8')
        req = request.Request(BASE_URL + path, data=body, method=method,
                              headers={'Authorization': 'Bearer ' + self.settings.api_key,
                                       'Content-Type': 'application/json',
                                       'Accept': 'application/json, text/event-stream'})
        try:
            response = self.opener.open(req, timeout=self.timeout)
            if response.status not in (200, 202):
                response.close()
                raise ProviderError('UNEXPECTED_HTTP_STATUS', uncertain=method == 'POST')
            return response
        except error.HTTPError as exc:
            status = exc.code
            if exc.fp is not None:
                exc.close()
            raise ProviderError(f'HTTP_{status}', uncertain=method == 'POST' and (status >= 500 or 300 <= status < 400)) from None
        except (error.URLError, TimeoutError, OSError):
            raise ProviderError('NETWORK_ERROR', uncertain=method == 'POST') from None

    @staticmethod
    def _id(value):
        if (not isinstance(value, str) or not value or len(value) > 255 or value in ('.', '..')
                or any(c.isspace() or c in '/\\?#' for c in value)):
            raise ProviderError('INVALID_RESOURCE_ID')
        return parse.quote(value, safe='')

    def get_knowledge(self):
        with self._open('GET', '/knowledge') as response:
            return business_data(_read_json(response))

    def create_conversation(self, external_uid, title):
        if not self.settings.template_id:
            raise ProviderError('TEMPLATE_NOT_CONFIGURED')
        with self._open('POST', '/conversation', {'template_id': self.settings.template_id,
                                                'external_uid': external_uid, 'title': title}) as response:
            try:
                data = business_data(_read_json(response))
                session_id = data.get('session_id') if isinstance(data, dict) else None
                self._id(session_id)
                return session_id
            except ProviderError as exc:
                raise ProviderError(exc.code, uncertain=True) from None

    def get_result(self, session_id):
        with self._open('GET', '/conversation/' + self._id(session_id) + '/result') as response:
            data = business_data(_read_json(response))
            if not isinstance(data, dict) or data.get('session_id') != session_id or not isinstance(data.get('messages'), list):
                raise ProviderError('RESULT_SESSION_MISMATCH')
            return data

    def get_detail(self, session_id):
        with self._open('GET', '/conversation/' + self._id(session_id) + '/detail') as response:
            return business_data(_read_json(response))

    def stop(self, session_id):
        with self._open('POST', '/conversation/' + self._id(session_id) + '/stop') as response:
            return business_data(_read_json(response))

    def send_message(self, session_id, content, on_event=None):
        types, count, complete = [], 0, False
        payload = {'content': content, 'language': 'zh'}
        if self.settings.model_api_key:
            payload['model_api_key'] = self.settings.model_api_key
        try:
            with self._open('POST', '/conversation/' + self._id(session_id) + '/send', payload) as response:
                content_type = response.headers.get('Content-Type', '').split(';', 1)[0].strip().lower()
                if content_type != 'text/event-stream':
                    if content_type == 'application/json':
                        business_data(_read_json(response))
                    raise ProviderError('SEND_PROTOCOL_NOT_CONFIRMED', uncertain=True)
                for frame in read_sse(response):
                    count += 1
                    typ = frame['event']
                    try:
                        obj = strict_json(frame['data'])
                    except ContractError:
                        obj = None
                    if isinstance(obj, dict):
                        if obj.get('type'):
                            typ = str(obj['type'])[:128]
                        if typ in ('error', 'failed') or obj.get('error'):
                            raise ProviderError('STREAM_ERROR_EVENT', uncertain=True)
                        if 'code' in obj and obj['code'] != 200:
                            raise ProviderError('STREAM_BUSINESS_ERROR', uncertain=True)
                        if typ == 'session_init':
                            nested = obj.get('data')
                            remote_id = obj.get('session_id') or (nested.get('session_id') if isinstance(nested, dict) else None)
                            if remote_id is not None and remote_id != session_id:
                                raise ProviderError('STREAM_SESSION_MISMATCH', uncertain=True)
                    if typ not in types:
                        types.append(typ)
                    if on_event:
                        on_event(frame)
                    expected = self.settings.completion_event
                    if expected and expected in (typ, frame['event'], frame['data']):
                        complete = True
        except ProviderError as exc:
            if exc.code in ('INVALID_PROVIDER_JSON', 'UNKNOWN_PROVIDER_ENVELOPE', 'RESPONSE_TOO_LARGE'):
                raise ProviderError(exc.code, uncertain=True) from None
            raise
        except (TimeoutError, OSError):
            raise ProviderError('STREAM_INTERRUPTED', uncertain=True) from None
        return StreamReceipt(types, complete, count)


def select_decision(result, package):
    """Require a unique assistant JSON belonging to this exact input revision/round."""
    candidates = []
    for message in result.get('messages', []):
        if not isinstance(message, dict) or message.get('role') != 'assistant':
            continue
        try:
            value = strict_json(message.get('content', ''))
        except ContractError:
            continue
        if isinstance(value, dict) and value.get('round_id') == package['round_id']:
            candidates.append(value)
    if len(candidates) != 1:
        raise ContractError('NO_UNIQUE_CURRENT_ROUND_RESULT')
    return validate_decision(candidates[0], package)
