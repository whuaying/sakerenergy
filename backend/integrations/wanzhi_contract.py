"""Validate proposed Saker decisions; provider output is never an executable command."""
import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = json.loads((ROOT / 'docs/integrations/wanzhi/decision.schema.json').read_text(encoding='utf-8'))
Draft202012Validator.check_schema(SCHEMA)
VALIDATOR = Draft202012Validator(SCHEMA)
QUERY_KINDS = {'telemetry_window', 'topology_neighbors', 'manual_search'}


class ContractError(ValueError):
    """Only constant error identifiers are exposed, never provider response contents."""


def strict_json(text):
    def pairs(items):
        obj = {}
        for key, value in items:
            if key in obj:
                raise ContractError('DUPLICATE_JSON_KEY')
            obj[key] = value
        return obj
    def invalid_number(value):
        raise ContractError('NON_FINITE_JSON_NUMBER')
    try:
        return json.loads(text, object_pairs_hook=pairs, parse_constant=invalid_number)
    except (ValueError, TypeError):
        raise ContractError('INVALID_JSON') from None


def validate_package(package):
    if not isinstance(package, dict):
        raise ContractError('INVALID_EVIDENCE_PACKAGE')
    for key in ('schema_version', 'event_id', 'input_revision', 'round_id', 'data_origin', 'trace_id',
                'evidence', 'available_queries', 'query_budget_remaining'):
        if key not in package:
            raise ContractError('INCOMPLETE_EVIDENCE_PACKAGE')
    if package['schema_version'] != '1.0':
        raise ContractError('UNKNOWN_SCHEMA_VERSION')
    for key in ('event_id', 'round_id', 'trace_id', 'data_origin'):
        if not isinstance(package[key], str) or not 1 <= len(package[key]) <= 128:
            raise ContractError('INVALID_PACKAGE_IDENTIFIER')
    if type(package['input_revision']) is not int or package['input_revision'] < 1:
        raise ContractError('INVALID_INPUT_REVISION')
    if type(package['query_budget_remaining']) is not int or not 0 <= package['query_budget_remaining'] <= 3:
        raise ContractError('INVALID_QUERY_BUDGET')
    evidence = package['evidence']
    if not isinstance(evidence, list) or len(evidence) > 128:
        raise ContractError('INVALID_EVIDENCE_LIST')
    ids = []
    for item in evidence:
        if not isinstance(item, dict) or not isinstance(item.get('evidence_id'), str) or not item['evidence_id']:
            raise ContractError('INVALID_EVIDENCE_ID')
        if item.get('quality') not in ('good', 'uncertain', 'bad', 'missing') or not item.get('source'):
            raise ContractError('EVIDENCE_PROVENANCE_REQUIRED')
        ids.append(item['evidence_id'])
    if len(set(ids)) != len(ids):
        raise ContractError('DUPLICATE_EVIDENCE_ID')
    queries = package['available_queries']
    if not isinstance(queries, list) or len(queries) > 16:
        raise ContractError('INVALID_QUERY_LIST')
    query_ids = []
    for query in queries:
        if not isinstance(query, dict) or query.get('kind') not in QUERY_KINDS:
            raise ContractError('QUERY_KIND_NOT_ALLOWED')
        if not isinstance(query.get('query_id'), str) or not query['query_id']:
            raise ContractError('INVALID_QUERY_ID')
        if type(query.get('cost_units')) is not int or query['cost_units'] < 1:
            raise ContractError('INVALID_QUERY_COST')
        query_ids.append(query['query_id'])
    if len(set(query_ids)) != len(query_ids):
        raise ContractError('DUPLICATE_QUERY_ID')
    # Reject NaN/Infinity anywhere in input, including nested measurements.
    try:
        encoded = json.dumps(package, ensure_ascii=False, allow_nan=False)
    except (TypeError, ValueError):
        raise ContractError('INVALID_EVIDENCE_JSON') from None
    if len(encoded.encode('utf-8')) > 65536:
        raise ContractError('EVIDENCE_PACKAGE_TOO_LARGE')
    return package


def validate_decision(decision, package):
    validate_package(package)
    if not VALIDATOR.is_valid(decision):
        raise ContractError('DECISION_SCHEMA_INVALID')
    for key in ('schema_version', 'event_id', 'input_revision', 'round_id', 'data_origin'):
        if decision[key] != package[key]:
            raise ContractError('DECISION_ROUND_MISMATCH')
    evidence_ids = {e['evidence_id'] for e in package['evidence']}
    hypotheses = decision['hypotheses']
    if [h['rank'] for h in hypotheses] != list(range(1, len(hypotheses) + 1)):
        raise ContractError('RANK_SEQUENCE_INVALID')
    if len({h['hypothesis_id'] for h in hypotheses}) != len(hypotheses):
        raise ContractError('DUPLICATE_HYPOTHESIS_ID')
    for h in hypotheses:
        support = set(h['support_evidence_ids'])
        against = set(h['against_evidence_ids'])
        if not (support | against) <= evidence_ids:
            raise ContractError('UNKNOWN_EVIDENCE_REFERENCE')
        if support & against:
            raise ContractError('AMBIGUOUS_SUPPORT_AND_COUNTEREVIDENCE')
    allowed = {q['query_id']: q for q in package['available_queries']}
    for query in decision['requested_evidence']:
        q = allowed.get(query['query_id'])
        if q is None:
            raise ContractError('QUERY_NOT_ALLOWED')
        if q['cost_units'] > package['query_budget_remaining']:
            raise ContractError('QUERY_BUDGET_EXCEEDED')
    if not hypotheses and (not decision['abstain'] or decision['status'] != 'NEEDS_HUMAN'):
        raise ContractError('EMPTY_HYPOTHESES_REQUIRE_HUMAN')
    if any(e['quality'] != 'good' for e in package['evidence']) and not decision['abstain']:
        raise ContractError('LOW_QUALITY_REQUIRES_ABSTENTION')
    # This stage permits candidates only. It never asserts a confirmed physical cause.
    if not decision['abstain']:
        raise ContractError('ADVISORY_MODE_REQUIRES_ABSTENTION')
    return decision
