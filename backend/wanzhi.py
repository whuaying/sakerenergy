"""Local setup, contract validation and single-event real Wanzhi API probe.

All provider state is saved under ignored backend/.private/wanzhi.
The public website and industrial work-order API are not changed by this CLI.
"""
import argparse
from dataclasses import asdict
from datetime import datetime, timezone
import getpass
import hmac
import hashlib
import json
from pathlib import Path
import sys
import uuid

from integrations.wanzhi_config import (ConfigError, Settings, PRIVATE, ROOT, load_settings,
                                        registration_settings, save_settings, validate_key)
from integrations.wanzhi_contract import ContractError, strict_json, validate_decision, validate_package
from integrations.wanzhi_client import ProviderError, WanzhiClient, redact, select_decision

DOCS = ROOT / 'docs/integrations/wanzhi'


def output(value, key=''):
    print(redact(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False), key))


def read(path):
    return strict_json(Path(path).read_text(encoding='utf-8-sig'))


def prompt_key(label='OpenAPI Key', optional=False):
    for _ in range(3):
        suffix = '; blank to keep existing/skip' if optional else ''
        secret = getpass.getpass(label + ' (hidden; use right-click paste if needed' + suffix + '): ').strip()
        if optional and not secret:
            return ''
        try:
            validate_key(secret)
        except ConfigError:
            print('Invalid key text: empty, control characters or unsupported characters. No key saved.')
            continue
        confirmation = getpass.getpass('Paste the same ' + label + ' again (hidden): ').strip()
        try:
            validate_key(confirmation)
        except ConfigError:
            print('Invalid confirmation input. No key saved.')
            continue
        if hmac.compare_digest(secret, confirmation):
            return secret
        print('The two entries do not match. No key saved.')
    raise ConfigError('KEY_ENTRY_NOT_CONFIRMED_NO_CHANGE')


def run_path(run_id):
    try:
        normalized = str(uuid.UUID(run_id))
    except (ValueError, AttributeError):
        raise ConfigError('INVALID_RUN_ID') from None
    if normalized != run_id:
        raise ConfigError('INVALID_RUN_ID')
    return PRIVATE / 'runs' / (normalized + '.json')


def save_record(record, key=''):
    path = run_path(record['run_id'])
    path.parent.mkdir(parents=True, exist_ok=True)
    record['updated_at'] = datetime.now(timezone.utc).isoformat()
    serialized = redact(json.dumps(record, ensure_ascii=False, indent=2, allow_nan=False), key)
    # One synchronous CLI process owns this run; reads never resend a message.
    temp = path.with_suffix('.tmp')
    temp.write_text(serialized, encoding='utf-8')
    temp.replace(path)


def create_record(package, run_id=None):
    run_id = run_id or str(uuid.uuid4())
    path = run_path(run_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {'run_id': run_id, 'state': 'PREPARED', 'source': 'LIVE_API_ATTEMPT',
              'input': package, 'session_id': None, 'completion_confirmed': False,
              'input_sha256': hashlib.sha256(json.dumps(package, sort_keys=True, ensure_ascii=False).encode()).hexdigest()}
    try:
        # Exclusive creation prevents a second POST if a caller reuses a run identifier.
        with path.open('x', encoding='utf-8') as handle:
            json.dump(record, handle, ensure_ascii=False, indent=2)
    except FileExistsError:
        raise ConfigError('RUN_ALREADY_EXISTS_USE_RESUME_NO_RESEND') from None
    return record


def retrieve(record, client, settings):
    result = client.get_result(record['session_id'])
    # The payload contract deliberately checks current round, not just the last text.
    decision = select_decision(result, record['input'])
    receipt = record.get('receipt', {})
    if settings.completion_event and settings.completion_event in receipt.get('event_types', []):
        # Only a successfully consumed stream produces a receipt; interrupted streams do not.
        record['completion_confirmed'] = True
    record['decision'] = decision
    record['state'] = 'VALIDATED_ADVISORY' if record['completion_confirmed'] else 'NEEDS_PROTOCOL_CONFIRMATION'
    save_record(record, settings.api_key)
    return record


def run_live(package, settings, client=None, run_id=None):
    validate_package(package)
    # The integration gate permits only explicitly hand-authored fixture origins.
    if package['data_origin'] not in ('SYNTHETIC_DEVELOPMENT_FIXTURE', 'INDUSTRY_DEMO_FIXTURE'):
        raise ContractError('INITIAL_PROBE_ACCEPTS_FIXTURE_ORIGIN_ONLY')
    if not settings.api_key or not settings.template_id:
        raise ConfigError('CONFIGURE_KEY_AND_TEMPLATE_FIRST')
    record = create_record(package, run_id)
    output({'run_id': record['run_id'], 'state': record['state']})
    client = client or WanzhiClient(settings)
    stage = 'CREATING'
    try:
        record['state'] = stage
        save_record(record, settings.api_key)
        record['session_id'] = client.create_conversation('saker-' + record['run_id'], 'Saker synthetic integration probe')
        record['state'] = 'CREATED'
        save_record(record, settings.api_key)
        stage = 'SENDING'
        record['state'] = stage
        save_record(record, settings.api_key)
        receipt = client.send_message(record['session_id'], json.dumps(package, ensure_ascii=False))
        record['receipt'] = asdict(receipt)
        record['completion_confirmed'] = receipt.completion_confirmed
        record['state'] = 'FETCHING_RESULT'
        save_record(record, settings.api_key)
        stage = 'FETCHING_RESULT'
        retrieve(record, client, settings)
    except (ProviderError, ContractError, OSError, ValueError) as exc:
        if stage in ('CREATING', 'SENDING') and (not isinstance(exc, ProviderError) or exc.uncertain):
            record['state'] = 'UNKNOWN_REMOTE_STATE'
        else:
            record['state'] = 'RESULT_NOT_VALIDATED' if stage == 'FETCHING_RESULT' else 'FAILED'
        record['error'] = exc.code if isinstance(exc, ProviderError) else (
            str(exc) if isinstance(exc, ContractError) else 'LOCAL_IO_OR_NETWORK_ERROR')
        save_record(record, settings.api_key)
    return record


def local_read_only_query(query_id, window):
    """SIMULATED read-only telemetry lookup; never claims real station data.

    The follow-up gate executes only read-only queries against locally declared
    fixtures and labels the result as simulation. It never fabricates live values.
    """
    if query_id != 'Q01':
        raise ContractError('QUERY_NOT_ALLOWED')
    return {
        'query_id': 'Q01',
        'kind': 'telemetry_window',
        'result': 'ok',
        'samples': [
            {'time': window['from'], 'value': 396, 'unit': 'V'},
            {'time': window['to'], 'value': 396, 'unit': 'V'},
        ],
        'quality': 'good',
        'source': 'local_read_only_telemetry_simulation_v1',
    }


def _window_of(package):
    window = package.get('window')
    if isinstance(window, dict) and window.get('from') and window.get('to'):
        return {'from': window['from'], 'to': window['to']}
    times = []
    for item in package.get('evidence', []):
        for sample in item.get('samples', []):
            if sample.get('time'):
                times.append(sample['time'])
    if times:
        return {'from': min(times), 'to': max(times)}
    raise ContractError('NO_EVIDENCE_TIME_WINDOW')


def build_followup_package(parent_input, parent_decision):
    """Second-round evidence package: parent evidence + read-only query results."""
    if not isinstance(parent_decision, dict) or not isinstance(parent_decision.get('requested_evidence'), list):
        raise ContractError('FOLLOWUP_REQUIRES_REQUESTED_EVIDENCE')
    window = _window_of(parent_input)
    evidence = [dict(item) for item in parent_input.get('evidence', [])]
    existing = {item['evidence_id'] for item in evidence}
    covered = []
    serial = len(evidence) + 1
    for request in parent_decision['requested_evidence']:
        result = local_read_only_query(request['query_id'], window)
        evidence_id = 'E%02d' % serial
        while evidence_id in existing:
            serial += 1
            evidence_id = 'E%02d' % serial
        existing.add(evidence_id)
        evidence.append({
            'evidence_id': evidence_id,
            'device_ids': ['METER-01'],
            'point': 'bus_voltage_v',
            'unit': 'V',
            'samples': result['samples'],
            'quality': result['quality'],
            'source': result['source'],
            'provenance': 'read_only_query:' + request['query_id'],
        })
        covered.append(request['query_id'])
        serial += 1
    if not covered:
        raise ContractError('FOLLOWUP_REQUIRES_REQUESTED_EVIDENCE')
    missing = []
    for item in parent_input.get('missing_information', []):
        if any(k in item for k in ('METER-01', '母线电压')):
            continue
        missing.append(item)
    cost = sum((q.get('cost_units') or 1) for q in parent_input.get('available_queries', [])
               if q.get('query_id') in covered)
    package = {
        'schema_version': '1.0',
        'event_id': parent_input['event_id'],
        'input_revision': parent_input['input_revision'] + 1,
        'round_id': 'round-' + str(uuid.uuid4()),
        'trace_id': 'trace-' + str(uuid.uuid4()),
        'data_origin': parent_input['data_origin'],
        'description': (parent_input.get('description', '') +
                        '（第2轮：补充只读遥测证据 ' + ','.join(covered) + '，结果为本地模拟值）'),
        'window': window,
        'evidence': evidence,
        'missing_information': missing,
        'available_queries': parent_input.get('available_queries', []),
        'query_budget_remaining': max(0, parent_input['query_budget_remaining'] - cost),
    }
    return validate_package(package)


def run_followup(parent_record, settings, client=None):
    """Second round on the parent session: never creates a new conversation."""
    if parent_record.get('state') != 'VALIDATED_ADVISORY':
        raise ConfigError('FOLLOWUP_REQUIRES_VALIDATED_PARENT')
    if not parent_record.get('session_id'):
        raise ConfigError('NO_SESSION_ID_MANUAL_RECONCILIATION_REQUIRED_NO_RESEND')
    package = build_followup_package(parent_record['input'], parent_record['decision'])
    record = create_record(package)
    record['followup_of'] = parent_record['run_id']
    record['session_id'] = parent_record['session_id']
    client = client or WanzhiClient(settings)
    stage = 'SENDING'
    try:
        record['state'] = stage
        save_record(record, settings.api_key)
        receipt = client.send_message(record['session_id'], json.dumps(package, ensure_ascii=False))
        record['receipt'] = asdict(receipt)
        record['completion_confirmed'] = receipt.completion_confirmed
        record['state'] = 'FETCHING_RESULT'
        save_record(record, settings.api_key)
        stage = 'FETCHING_RESULT'
        retrieve(record, client, settings)
    except (ProviderError, ContractError, OSError, ValueError) as exc:
        record['state'] = 'RESULT_NOT_VALIDATED' if stage == 'FETCHING_RESULT' else 'FAILED'
        record['error'] = exc.code if isinstance(exc, ProviderError) else (
            str(exc) if isinstance(exc, ContractError) else 'LOCAL_IO_OR_NETWORK_ERROR')
        save_record(record, settings.api_key)
    return record


def main(argv=None):
    parser = argparse.ArgumentParser(description='Saker Energy Wanzhi local integration gate')
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--configure', action='store_true', help='hidden key entry; Windows user-bound encryption')
    mode.add_argument('--check', action='store_true', help='offline configuration presence only')
    mode.add_argument('--probe', action='store_true', help='authenticated GET /knowledge; no conversation')
    mode.add_argument('--validate', metavar='DECISION_JSON', help='offline schema and semantic validation')
    mode.add_argument('--run', action='store_true', help='one real synthetic conversation (may consume quota)')
    mode.add_argument('--resume', metavar='RUN_ID', help='GET-only reconciliation; never resend')
    mode.add_argument('--followup', metavar='RUN_ID', help='second round on an existing session; simulated read-only telemetry then resend')
    parser.add_argument('--input', default=str(DOCS / 'evidence-package.example.json'))
    parser.add_argument('--run-id', help='optional UUID idempotency identifier for --run')
    args = parser.parse_args(argv)
    key = ''
    try:
        if args.validate:
            validate_decision(read(args.validate), read(args.input))
            output({'state': 'OFFLINE_CONTRACT_VALID', 'live_api_verified': False})
            return 0
        if args.configure:
            if not sys.stdin.isatty():
                raise ConfigError('CONFIGURE_REQUIRES_INTERACTIVE_TERMINAL')
            defaults = registration_settings()
            secret = prompt_key()
            template = input('Agent/workflow template ID [' + defaults.template_id + '] (Enter to keep): ').strip() or defaults.template_id
            public_url = input('Agent page/URL [' + defaults.public_url + '] (Enter to keep): ').strip() or defaults.public_url
            model_key = prompt_key('Model API Key', optional=True)
            save_settings(Settings(secret, template, public_url, defaults.completion_event, model_api_key=model_key))
            output({'state': 'CONFIGURED_LOCALLY', 'encrypted_for_current_windows_user': True,
                    'key_entries_match': True, 'key_text_format_valid': True,
                    'live_api_verified': False})
            return 0
        settings = load_settings()
        key = settings.api_key
        if args.check:
            output(settings.readiness())
            return 0
        client = WanzhiClient(settings)
        if args.probe:
            data = client.get_knowledge()
            output({'state': 'KNOWLEDGE_READ_PROBE_SUCCEEDED',
                    'knowledge_count': len(data) if isinstance(data, list) else None,
                    'agent_call_verified': False})
            return 0
        if args.resume:
            record = read(run_path(args.resume))
            if not record.get('session_id'):
                raise ConfigError('NO_SESSION_ID_MANUAL_RECONCILIATION_REQUIRED_NO_RESEND')
            try:
                retrieve(record, client, settings)
            except (ContractError, ProviderError):
                raise ConfigError('CURRENT_ROUND_NOT_CONFIRMED_NO_RESEND') from None
        elif args.followup:
            parent = read(run_path(args.followup))
            record = run_followup(parent, settings, client)
        else:
            package = read(args.input)
            # Prevent accidentally reusing the published sample round ID across different live runs.
            package['round_id'] = 'round-' + str(uuid.uuid4())
            package['trace_id'] = 'trace-' + str(uuid.uuid4())
            record = run_live(package, settings, client, args.run_id)
        output({k: v for k, v in record.items() if k != 'input'}, key)
        return 0 if record['state'] == 'VALIDATED_ADVISORY' else 2
    except (ConfigError, ContractError, ProviderError) as exc:
        output({'state': 'NOT_READY_OR_NOT_VALIDATED', 'error': str(exc), 'live_api_verified': False}, key)
        return 2
    except (OSError, ValueError):
        output({'state': 'LOCAL_INPUT_OR_IO_ERROR', 'live_api_verified': False})
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
