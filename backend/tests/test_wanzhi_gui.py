"""Credential setup tests use fake keys and fake transport only."""
import json
from pathlib import Path
import sys
import tempfile
import time
import tkinter as tk
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from integrations.wanzhi_client import ProviderError
from integrations.wanzhi_config import Settings, load_settings, save_settings
from integrations.wanzhi_gui import SetupResult, SetupWindow, save_and_probe

FAKE_KEY = 'sk-GUI-OFFLINE-TEST-NOT-A-REAL-KEY'


class SetupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'config.json'

    @patch.dict('os.environ', {'WANZHI_OPENAPI_KEY': ''})
    def test_encrypt_preserve_model_and_probe_exact_entered_key(self):
        save_settings(Settings(FAKE_KEY, 'agent', model_api_key='fake-model-key'), self.path)
        factory = unittest.mock.Mock()
        result = save_and_probe(Settings(FAKE_KEY, 'agent'), self.path, factory)
        self.assertTrue(result.saved and result.probe_verified)
        factory.assert_called_once_with(Settings(FAKE_KEY, 'agent'))
        self.assertEqual(load_settings(self.path).model_api_key, 'fake-model-key')
        self.assertNotIn(FAKE_KEY, self.path.read_text())
        self.assertNotIn('fake-model-key', self.path.read_text())

    def test_invalid_input_preserves_existing_config_and_does_not_probe(self):
        save_settings(Settings(FAKE_KEY, 'agent'), self.path)
        before = self.path.read_bytes()
        factory = unittest.mock.Mock()
        result = save_and_probe(Settings('bad\x16key'), self.path, factory)
        self.assertFalse(result.saved)
        self.assertEqual(before, self.path.read_bytes())
        factory.assert_not_called()

    def test_failed_probe_still_reports_saved_without_exception_leak(self):
        for error in (ProviderError('HTTP_401'), ProviderError('HTTP_403'),
                      ProviderError('HTTP_400'), RuntimeError(FAKE_KEY)):
            factory = unittest.mock.Mock(side_effect=error)
            result = save_and_probe(Settings(FAKE_KEY), self.path, factory)
            self.assertTrue(result.saved)
            self.assertFalse(result.probe_verified)
            self.assertNotIn(FAKE_KEY, result.message)

    def test_gui_single_paste_async_status_and_secret_clearing(self):
        root = tk.Tk()
        root.withdraw()
        service = unittest.mock.Mock(return_value=SetupResult(True, True, 'offline check passed'))
        window = SetupWindow(root, self.path, service)
        self.addCleanup(lambda: None if window.closed else window.close())
        self.assertEqual(window.entry.cget('show'), '●')
        window.key.set(FAKE_KEY)
        window.submit()
        window.submit()  # Busy guard must prevent duplicate probe.
        deadline = time.monotonic() + 3
        while window.busy and time.monotonic() < deadline:
            root.update()
            time.sleep(0.01)
        self.assertFalse(window.busy)
        self.assertEqual(window.status.get(), 'offline check passed')
        self.assertEqual(window.key.get(), '')
        service.assert_called_once()
        window.close()

    def test_gui_can_replace_malformed_old_key_without_decrypting_it(self):
        self.path.write_text(json.dumps({'key_protected': 'broken', 'template_id': 'kept-agent'}))
        root = tk.Tk()
        root.withdraw()
        window = SetupWindow(root, self.path)
        try:
            self.assertEqual(window.template.get(), 'kept-agent')
            window.submit()
            self.assertFalse(window.busy)
            self.assertIn('请先粘贴', window.status.get())
        finally:
            window.close()
