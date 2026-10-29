"""Offline contract/transport/checkpoint tests. No real platform or real key is used."""
import contextlib
from copy import deepcopy
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib import error
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from integrations.wanzhi_config import (ConfigError, Settings, _dpapi, load_settings, save_settings,
                                        registration_settings, validate_key)
from integrations.wanzhi_contract import ContractError, strict_json, validate_decision, validate_package
from integrations.wanzhi_client import (NoRedirect, ProviderError, StreamReceipt, WanzhiClient,
                                       read_sse, redact, select_decision)
import wanzhi

DOCS = Path(__file__).resolve().parents[2] / 'docs/integrations/wanzhi'


def fixture(name):
    return json.loads((DOCS / name).read_text(encoding='utf-8'))


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.package = fixture('evidence-package.example.json')
        self.decision = fixture('decision.example.json')

    def test_published_fixture_schema_and_references(self):
        self.assertEqual(validate_decision(self.decision, self.package), self.decision)

    def test_unknown_fields_rejected(self):
        self.decision['command'] = 'unlock'
        with self.assertRaisesRegex(ContractError, 'SCHEMA'):
            validate_decision(self.decision, self.package)

    def test_duplicate_json_key_rejected(self):
        with self.assertRaises(ContractError):
            strict_json('{"abstain":true,"abstain":false}')

    def test_nonfinite_json_rejected(self):
        with self.assertRaises(ContractError):
            strict_json('{"value":NaN}')

    def test_markdown_is_not_a_valid_decision_json(self):
        with self.assertRaises(ContractError):
            strict_json('```json\n{}\n```')

    def test_stale_round_rejected(self):
        for key in ('round_id', 'event_id', 'data_origin', 'input_revision'):
            decision = deepcopy(self.decision)
            decision[key] = 2 if key == 'input_revision' else 'other'
            with self.assertRaisesRegex(ContractError, 'ROUND_MISMATCH'):
                validate_decision(decision, self.package)

    def test_unknown_evidence_reference_rejected(self):
        self.decision['hypotheses'][0]['support_evidence_ids'] = ['fabricated-reading']
        with self.assertRaisesRegex(ContractError, 'UNKNOWN_EVIDENCE'):
            validate_decision(self.decision, self.package)

    def test_same_reference_cannot_be_support_and_against(self):
        self.decision['hypotheses'][0]['against_evidence_ids'] = ['E01']
        with self.assertRaisesRegex(ContractError, 'AMBIGUOUS_SUPPORT'):
            validate_decision(self.decision, self.package)

    def test_user_reported_web_output_is_preserved_and_rejected_for_overlap(self):
        observed = fixture('observations/2026-10-28-web-first-turn.json')
        with self.assertRaisesRegex(ContractError, 'AMBIGUOUS_SUPPORT'):
            validate_decision(observed, self.package)

    def test_followup_inputs_have_distinct_rounds_and_exhausted_budget(self):
        rounds = set()
        for name in ('no-budget', 'voltage-normal', 'voltage-sag', 'voltage-missing'):
            package = fixture(name + '.input.json')
            validate_package(package)
            self.assertEqual(package['query_budget_remaining'], 0)
            self.assertEqual(package['available_queries'], [])
            rounds.add(package['round_id'])
        self.assertEqual(len(rounds), 4)

    def test_budget_exhaustion_rejected(self):
        self.package['query_budget_remaining'] = 0
        with self.assertRaisesRegex(ContractError, 'BUDGET_EXCEEDED'):
            validate_decision(self.decision, self.package)

    def test_unknown_query_rejected(self):
        self.decision['requested_evidence'][0]['query_id'] = 'execute_sql'
        with self.assertRaisesRegex(ContractError, 'QUERY_NOT_ALLOWED'):
            validate_decision(self.decision, self.package)

    def test_invalid_query_cost_rejected(self):
        self.package['available_queries'][0]['cost_units'] = 0
        with self.assertRaisesRegex(ContractError, 'QUERY_COST'):
            validate_package(self.package)

    def test_arbitrary_tool_type_rejected(self):
        self.package['available_queries'][0]['kind'] = 'equipment_control'
        with self.assertRaisesRegex(ContractError, 'QUERY_KIND'):
            validate_package(self.package)

    def test_duplicate_evidence_rejected(self):
        self.package['evidence'].append(self.package['evidence'][0])
        with self.assertRaisesRegex(ContractError, 'DUPLICATE_EVIDENCE'):
            validate_package(self.package)

    def test_rank_sequence_and_duplicate_hypotheses_rejected(self):
        self.decision['hypotheses'][0]['rank'] = 2
        with self.assertRaisesRegex(ContractError, 'RANK_SEQUENCE'):
            validate_decision(self.decision, self.package)
        self.decision = fixture('decision.example.json')
        self.decision['hypotheses'][1]['hypothesis_id'] = 'H1'
        with self.assertRaisesRegex(ContractError, 'DUPLICATE_HYPOTHESIS'):
            validate_decision(self.decision, self.package)

    def test_no_budget_human_review_is_valid(self):
        self.package['query_budget_remaining'] = 0
        self.package['available_queries'] = []
        self.decision.update(status='NEEDS_HUMAN', requested_evidence=[])
        validate_decision(self.decision, self.package)

    def test_human_review_requires_actual_check_list(self):
        self.decision.update(status='NEEDS_HUMAN', requested_evidence=[], human_checks=[])
        with self.assertRaisesRegex(ContractError, 'SCHEMA'):
            validate_decision(self.decision, self.package)

    def test_advisory_mode_never_confirms_physical_root_cause(self):
        self.decision['abstain'] = False
        with self.assertRaisesRegex(ContractError, 'ABSTENTION'):
            validate_decision(self.decision, self.package)


class Response(io.BytesIO):
    def __init__(self, body, content_type='application/json'):
        super().__init__(body)
        self.status, self.headers = 200, {'Content-Type': content_type}


class Opener:
    def __init__(self, responses):
        self.responses, self.requests = list(responses), []

    def open(self, req, timeout):
        self.requests.append(req)
        result = self.responses.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


class TransportTests(unittest.TestCase):
    def settings(self, event=''):
        return Settings('sk-fixture-not-a-real-credential', 'fixture-agent', completion_event=event)

    def test_explicit_create_contract(self):
        opener = Opener([Response(b'{"code":200,"data":{"session_id":"s1"}}')])
        client = WanzhiClient(self.settings(), opener)
        self.assertEqual(client.create_conversation('external', 'title'), 's1')
        req = opener.requests[0]
        self.assertEqual(req.full_url, 'https://www.wanzhi.com/app/api/v1/open-api/conversation')
        self.assertEqual(json.loads(req.data)['template_id'], 'fixture-agent')
        self.assertNotIn('model_api_key', json.loads(req.data))

    def test_empty_session_is_uncertain_not_success(self):
        opener = Opener([Response(b'{"code":200,"data":{}}')])
        with self.assertRaises(ProviderError) as caught:
            WanzhiClient(self.settings(), opener).create_conversation('x', 'x')
        self.assertTrue(caught.exception.uncertain)

    def test_business_error_is_not_http_success(self):
        opener = Opener([Response(b'{"code":403,"message":"do not echo this"}')])
        with self.assertRaisesRegex(ProviderError, '^PROVIDER_BUSINESS_ERROR$'):
            WanzhiClient(self.settings(), opener).get_knowledge()

    def test_http_error_does_not_echo_upstream_body_or_key(self):
        opener = Opener([error.HTTPError('https://www.wanzhi.com', 403, 'secret server body', {}, io.BytesIO(b'private diagnostic'))])
        with self.assertRaisesRegex(ProviderError, '^HTTP_403$'):
            WanzhiClient(self.settings(), opener).get_knowledge()

    def test_network_failure_post_is_uncertain_and_never_retried(self):
        opener = Opener([error.URLError('secret internal error')])
        with self.assertRaises(ProviderError) as caught:
            WanzhiClient(self.settings(), opener).create_conversation('x', 'x')
        self.assertTrue(caught.exception.uncertain)
        self.assertEqual(len(opener.requests), 1)
        self.assertNotIn('secret', str(caught.exception))

    def test_redirect_policy_never_forwards_credentials(self):
        self.assertIsNone(NoRedirect().redirect_request(None, None, 302, '', {}, 'https://untrusted.example'))

    def test_sse_bom_crlf_multiline_and_comments(self):
        body = '\ufeff: keepalive\r\nevent: sample\r\nid: m1\r\ndata: {"a":\r\ndata: "中文"}\r\n\r\n'.encode()
        events = list(read_sse(io.BytesIO(body)))
        self.assertEqual(len(events), 1)
        self.assertEqual(strict_json(events[0]['data']), {'a': '中文'})
        self.assertEqual(events[0]['id'], 'm1')

    def test_truncated_sse_is_uncertain(self):
        with self.assertRaisesRegex(ProviderError, 'TRUNCATED'):
            list(read_sse(io.BytesIO(b'data: {"type":"done"}')))

    def test_unknown_end_protocol_is_not_marked_completed(self):
        opener = Opener([Response(b'data: {"type":"vendor-final"}\n\n', 'text/event-stream')])
        receipt = WanzhiClient(self.settings(), opener).send_message('s1', 'synthetic')
        self.assertFalse(receipt.completion_confirmed)
        self.assertEqual(receipt.event_types, ['vendor-final'])

    def test_only_explicitly_configured_completion_contract_is_accepted(self):
        opener = Opener([Response(b'data: {"type":"fixture.complete"}\n\n', 'text/event-stream')])
        receipt = WanzhiClient(self.settings('fixture.complete'), opener).send_message('s1', 'synthetic')
        self.assertTrue(receipt.completion_confirmed)

    def test_error_after_completion_is_not_success(self):
        opener = Opener([Response(b'data: {"type":"fixture.complete"}\n\ndata: {"type":"error"}\n\n', 'text/event-stream')])
        with self.assertRaisesRegex(ProviderError, 'STREAM_ERROR'):
            WanzhiClient(self.settings('fixture.complete'), opener).send_message('s1', 'x')

    def test_send_json_error_not_treated_as_sse(self):
        opener = Opener([Response(b'{"code":200,"data":null}')])
        with self.assertRaisesRegex(ProviderError, 'PROTOCOL_NOT_CONFIRMED'):
            WanzhiClient(self.settings(), opener).send_message('s1', 'x')

    def test_malformed_send_response_has_unknown_remote_outcome(self):
        opener = Opener([Response(b'{malformed')])
        with self.assertRaises(ProviderError) as caught:
            WanzhiClient(self.settings(), opener).send_message('s1', 'x')
        self.assertTrue(caught.exception.uncertain)

    def test_result_session_mismatch_rejected(self):
        opener = Opener([Response(b'{"code":200,"data":{"session_id":"other","messages":[]}}')])
        with self.assertRaisesRegex(ProviderError, 'SESSION_MISMATCH'):
            WanzhiClient(self.settings(), opener).get_result('s1')

    def test_result_must_be_unique_current_assistant_decision(self):
        package, decision = fixture('evidence-package.example.json'), fixture('decision.example.json')
        message = {'role': 'assistant', 'content': json.dumps(decision)}
        self.assertEqual(select_decision({'messages': [message]}, package), decision)
        for messages in ([message, message], [{'role': 'tool', 'content': message['content']}], []):
            with self.assertRaises(ContractError):
                select_decision({'messages': messages}, package)

    def test_redaction_and_config_repr(self):
        self.assertNotIn(self.settings().api_key, repr(self.settings()))
        self.assertEqual(redact('x sk-fixture-not-a-real-credential'), 'x [REDACTED]')


class CheckpointTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.patch = patch.object(wanzhi, 'PRIVATE', Path(self.temp.name))
        self.patch.start()
        self.settings = Settings('fixture-not-real', 'fixture-agent')

    def tearDown(self):
        self.patch.stop()
        self.temp.cleanup()

    def test_creation_timeout_keeps_unknown_checkpoint_no_resend(self):
        class Client:
            calls = 0
            def create_conversation(self, *args):
                self.calls += 1
                raise ProviderError('NETWORK_ERROR', uncertain=True)
        client = Client()
        rid = str(uuid.uuid4())
        with contextlib.redirect_stdout(io.StringIO()):
            result = wanzhi.run_live(fixture('evidence-package.example.json'), self.settings, client, rid)
        self.assertEqual(result['state'], 'UNKNOWN_REMOTE_STATE')
        self.assertIsNone(result['session_id'])
        with self.assertRaises(ConfigError):
            wanzhi.run_live(fixture('evidence-package.example.json'), self.settings, client, rid)
        self.assertEqual(client.calls, 1)

    def test_valid_json_without_completion_proof_is_not_live_success(self):
        class Client:
            def create_conversation(self, *args): return 's1'
            def send_message(self, *args): return StreamReceipt(['unverified.final'], False, 1)
            def get_result(self, *args):
                return {'session_id': 's1', 'messages': [{'role': 'assistant', 'content': json.dumps(fixture('decision.example.json'))}]}
        with contextlib.redirect_stdout(io.StringIO()):
            result = wanzhi.run_live(fixture('evidence-package.example.json'), self.settings, Client())
        self.assertEqual(result['state'], 'NEEDS_PROTOCOL_CONFIRMATION')
        self.assertEqual(json.loads(wanzhi.run_path(result['run_id']).read_text(encoding='utf-8'))['session_id'], 's1')
        self.assertNotIn(self.settings.api_key, wanzhi.run_path(result['run_id']).read_text(encoding='utf-8'))

    def test_non_synthetic_probe_rejected_before_network(self):
        package = fixture('evidence-package.example.json'); package['data_origin'] = 'REAL'
        with self.assertRaisesRegex(ContractError, 'FIXTURE_ORIGIN_ONLY'):
            wanzhi.run_live(package, self.settings)

    def test_industry_demo_origin_is_permitted(self):
        package = fixture('industry-demo.input.json')
        validate_package(package)
        self.assertEqual(package['data_origin'], 'INDUSTRY_DEMO_FIXTURE')

    def test_read_only_reconciliation_can_use_verified_completion_contract(self):
        package = fixture('evidence-package.example.json')
        record = wanzhi.create_record(package)
        record.update(session_id='s1', completion_confirmed=False,
                      receipt={'event_types': ['fixture.complete'], 'frame_count': 1})
        class ReadOnlyClient:
            def get_result(self, session_id):
                return {'session_id': session_id, 'messages': [{'role': 'assistant', 'content': json.dumps(fixture('decision.example.json'))}]}
        result = wanzhi.retrieve(record, ReadOnlyClient(), Settings('fixture', 'agent', completion_event='fixture.complete'))
        self.assertEqual(result['state'], 'VALIDATED_ADVISORY')

    def test_uuid_path_prevents_arbitrary_file_access(self):
        with self.assertRaises(ConfigError):
            wanzhi.run_path('../config')

    @unittest.skipUnless(sys.platform == 'win32', 'Windows DPAPI')
    def test_windows_user_bound_local_secret_roundtrip(self):
        path = Path(self.temp.name) / 'config.json'
        save_settings(self.settings, path)
        self.assertNotIn(self.settings.api_key, path.read_text())
        with patch.dict('os.environ', {'WANZHI_OPENAPI_KEY': '', 'WANZHI_TEMPLATE_ID': ''}):
            loaded = load_settings(path)
        self.assertEqual(loaded.api_key, self.settings.api_key)


class CredentialEntryTests(unittest.TestCase):
    def test_control_characters_are_rejected(self):
        for value in ('\x16fixture', 'fixture\x00', 'fixture\x1b[A', 'fixture value', 'fixture\n', '密钥'):
            with self.assertRaises(ConfigError):
                validate_key(value)

    def test_two_entries_must_match(self):
        with patch.object(wanzhi.getpass, 'getpass', side_effect=['first', 'second'] * 3):
            with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(ConfigError):
                wanzhi.prompt_key()

    def test_bad_control_input_retries_without_echo(self):
        capture = io.StringIO()
        with patch.object(wanzhi.getpass, 'getpass', side_effect=['\x16invalid-input', 'fixture-new-value', 'fixture-new-value']):
            with contextlib.redirect_stdout(capture):
                value = wanzhi.prompt_key()
        self.assertEqual(value, 'fixture-new-value')
        self.assertNotIn(value, capture.getvalue())
        self.assertNotIn('invalid-input', capture.getvalue())

    def test_registration_read_does_not_require_valid_old_secret(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'config.json'
            path.write_text(json.dumps({'key_protected':'invalid-cipher','template_id':'fixture-agent',
                                       'public_url':'https://www.wanzhi.com/studio/agent/fixture-agent'}))
            with patch.dict('os.environ', {}, clear=True):
                self.assertEqual(registration_settings(path).template_id, 'fixture-agent')
                with self.assertRaises(ConfigError):
                    load_settings(path)


class FollowupTests(unittest.TestCase):
    def setUp(self):
        self.package = fixture('evidence-package.example.json')
        self.parent_decision = {
            'schema_version': '1.0',
            'event_id': self.package['event_id'],
            'input_revision': self.package['input_revision'],
            'round_id': self.package['round_id'],
            'data_origin': self.package['data_origin'],
            'status': 'NEEDS_EVIDENCE',
            'abstain': True,
            'summary': '需要补齐一项只读证据以区分候选。',
            'hypotheses': [],
            'requested_evidence': [{'query_id': 'Q01', 'reason': '读取母线电压以区分候选。'}],
            'human_checks': [],
        }

    def test_followup_package_builds_from_validated_parent(self):
        package2 = wanzhi.build_followup_package(self.package, self.parent_decision)
        validate_package(package2)
        self.assertEqual(package2['input_revision'], 2)
        self.assertNotEqual(package2['round_id'], self.package['round_id'])
        self.assertEqual(package2['data_origin'], self.package['data_origin'])
        self.assertEqual(len(package2['evidence']), len(self.package['evidence']) + 1)
        extra = package2['evidence'][-1]
        self.assertEqual(extra['evidence_id'], 'E04')
        self.assertIn('simulation', extra['source'])
        self.assertEqual(extra['quality'], 'good')
        self.assertEqual(package2['query_budget_remaining'], self.package['query_budget_remaining'] - 1)
        self.assertFalse(any('母线电压' in item or 'METER-01' in item
                             for item in package2['missing_information']))

    def test_followup_requires_requested_evidence(self):
        decision = deepcopy(self.parent_decision)
        decision['requested_evidence'] = []
        with self.assertRaisesRegex(ContractError, 'FOLLOWUP_REQUIRES_REQUESTED_EVIDENCE'):
            wanzhi.build_followup_package(self.package, decision)

    def test_local_read_only_query_rejects_unknown_id(self):
        with self.assertRaisesRegex(ContractError, 'QUERY_NOT_ALLOWED'):
            wanzhi.local_read_only_query('execute_sql', {'from': '2026-10-28T10:00:00Z', 'to': '2026-10-28T10:01:00Z'})

    def test_followup_requires_validated_parent_record(self):
        record = {'run_id': str(uuid.uuid4()), 'state': 'RESULT_NOT_VALIDATED', 'session_id': None}
        with self.assertRaisesRegex(ConfigError, 'FOLLOWUP_REQUIRES_VALIDATED_PARENT'):
            wanzhi.run_followup(record, Settings('fixture', 'agent'))


if __name__ == '__main__':
    unittest.main()
