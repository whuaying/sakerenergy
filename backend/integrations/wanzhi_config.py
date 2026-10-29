"""Local Windows-user-bound credentials and environment overrides (no secret repr)."""
import base64
import ctypes
from ctypes import wintypes
from dataclasses import dataclass, field
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = ROOT / 'backend/.private/wanzhi'
CONFIG = PRIVATE / 'config.json'
BASE_URL = 'https://www.wanzhi.com/app/api/v1/open-api'


class ConfigError(ValueError):
    pass


def _dpapi(data, decrypt=False):
    if os.name != 'nt':
        raise ConfigError('DPAPI_REQUIRES_WINDOWS_USE_ENV_ON_OTHER_SYSTEMS')
    class Blob(ctypes.Structure):
        _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]
    buffer = (ctypes.c_ubyte * len(data)).from_buffer_copy(data)
    source = Blob(len(data), buffer)
    result = Blob()
    fn = ctypes.windll.crypt32.CryptUnprotectData if decrypt else ctypes.windll.crypt32.CryptProtectData
    fn.restype = wintypes.BOOL
    fn.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p,
                   ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    # CRYPTPROTECT_UI_FORBIDDEN, scoped to the current Windows user (no machine-wide flag).
    if not fn(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(result)):
        raise ConfigError('LOCAL_CREDENTIAL_PROTECTION_FAILED')
    try:
        return ctypes.string_at(result.data, result.size)
    finally:
        ctypes.windll.kernel32.LocalFree.argtypes = [ctypes.c_void_p]
        ctypes.windll.kernel32.LocalFree(ctypes.cast(result.data, ctypes.c_void_p))


@dataclass(frozen=True)
class Settings:
    api_key: str = field(default='', repr=False)
    template_id: str = ''
    public_url: str = ''
    completion_event: str = ''
    model_api_key: str = field(default='', repr=False)

    def readiness(self):
        return {'key_configured': bool(self.api_key), 'template_configured': bool(self.template_id),
                'public_url_configured': bool(self.public_url),
                'completion_event_configured': bool(self.completion_event),
                'model_api_key_configured': bool(self.model_api_key),
                'live_call_verified': False}


def _load_values(path):
    values = {}
    if path.exists():
        try:
            values = json.loads(path.read_text(encoding='utf-8'))
            if not isinstance(values, dict):
                raise ValueError()
        except (OSError, ValueError):
            raise ConfigError('INVALID_LOCAL_CONFIG') from None
    return values


def validate_key(key):
    if not isinstance(key, str) or not key or len(key) > 4096:
        raise ConfigError('KEY_REQUIRED_OR_INVALID')
    if any(not 33 <= ord(c) <= 126 for c in key):
        raise ConfigError('KEY_CONTAINS_CONTROL_OR_NON_ASCII_CHARACTERS_REENTER')


def registration_settings(path=CONFIG):
    """Read non-secret defaults without decrypting a potentially malformed key."""
    values = _load_values(path)
    return Settings('', os.getenv('WANZHI_TEMPLATE_ID', values.get('template_id', '')),
                    os.getenv('WANZHI_AGENT_PUBLIC_URL', values.get('public_url', '')),
                    os.getenv('WANZHI_COMPLETION_EVENT', values.get('completion_event', '')))


def load_settings(path=CONFIG):
    values = _load_values(path)
    key = os.getenv('WANZHI_OPENAPI_KEY', '')
    if not key and values.get('key_protected'):
        try:
            key = _dpapi(base64.b64decode(values['key_protected'], validate=True), decrypt=True).decode('utf-8')
        except Exception:
            raise ConfigError('CANNOT_DECRYPT_LOCAL_KEY') from None
    if key:
        validate_key(key)
    model_key = os.getenv('WANZHI_MODEL_API_KEY', '')
    if not model_key and values.get('model_key_protected'):
        try:
            model_key = _dpapi(base64.b64decode(values['model_key_protected'], validate=True), decrypt=True).decode('utf-8')
        except Exception:
            raise ConfigError('CANNOT_DECRYPT_LOCAL_MODEL_KEY') from None
    return Settings(key, os.getenv('WANZHI_TEMPLATE_ID', values.get('template_id', '')),
                    os.getenv('WANZHI_AGENT_PUBLIC_URL', values.get('public_url', '')),
                    os.getenv('WANZHI_COMPLETION_EVENT', values.get('completion_event', '')),
                    model_key)


def save_settings(settings, path=CONFIG):
    validate_key(settings.api_key)
    protected = base64.b64encode(_dpapi(settings.api_key.encode('utf-8'))).decode('ascii')
    model_protected = _load_values(path).get('model_key_protected')
    if settings.model_api_key:
        validate_key(settings.model_api_key)
        model_protected = base64.b64encode(_dpapi(settings.model_api_key.encode('utf-8'))).decode('ascii')
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps({'key_protected': protected, 'template_id': settings.template_id,
                               'public_url': settings.public_url, 'completion_event': settings.completion_event,
                               'model_key_protected': model_protected},
                              ensure_ascii=False, indent=2), encoding='utf-8')
    temp.replace(path)
