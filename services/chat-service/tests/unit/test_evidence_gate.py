"""Unit tests for EvidenceGate."""
import pytest
from app.ai.evidence_gate import EvidenceGate
from app.domain.value_objects.evidence import Evidence


def test_evidence_gate_placeholder():
    """Placeholder test preserved for backward compatibility."""
    assert True


def test_evidence_gate_empty_list_returns_false():
    gate = EvidenceGate()
    assert gate.evaluate([]) is False
    assert gate.filter_evidence([]) == []


def test_evidence_gate_none_returns_false():
    gate = EvidenceGate()
    assert gate.evaluate(None) is False
    assert gate.filter_evidence(None) == []


def test_evidence_gate_below_threshold():
    gate = EvidenceGate(min_confidence=0.65)
    candidates = [
        Evidence(evidence_id="1", document_id="d1", document_name="Doc 1", retrieval_score=0.45),
        Evidence(evidence_id="2", document_id="d2", document_name="Doc 2", retrieval_score=0.64),
    ]
    assert gate.evaluate(candidates) is False
    assert len(gate.filter_evidence(candidates)) == 0


def test_evidence_gate_exact_threshold():
    gate = EvidenceGate(min_confidence=0.65)
    candidates = [
        Evidence(evidence_id="1", document_id="d1", document_name="Doc 1", retrieval_score=0.65),
    ]
    assert gate.evaluate(candidates) is True
    assert len(gate.filter_evidence(candidates)) == 1


def test_evidence_gate_above_threshold():
    gate = EvidenceGate(min_confidence=0.65)
    candidates = [
        Evidence(evidence_id="1", document_id="d1", document_name="Doc 1", retrieval_score=0.85),
    ]
    assert gate.evaluate(candidates) is True
    assert len(gate.filter_evidence(candidates)) == 1


def test_evidence_gate_mixed_scores_and_filtering():
    gate = EvidenceGate(min_confidence=0.65)
    ev_low = Evidence(evidence_id="1", document_id="d1", document_name="Doc 1", retrieval_score=0.30)
    ev_mid = Evidence(evidence_id="2", document_id="d2", document_name="Doc 2", retrieval_score=0.64)
    ev_high1 = Evidence(evidence_id="3", document_id="d3", document_name="Doc 3", retrieval_score=0.72)
    ev_high2 = Evidence(evidence_id="4", document_id="d4", document_name="Doc 4", retrieval_score=0.91)

    candidates = [ev_low, ev_mid, ev_high1, ev_high2]
    assert gate.evaluate(candidates) is True

    filtered = gate.filter_evidence(candidates)
    assert len(filtered) == 2
    assert filtered == [ev_high1, ev_high2]


def test_evidence_gate_custom_threshold():
    gate = EvidenceGate(min_confidence=0.80)
    candidates = [
        Evidence(evidence_id="1", document_id="d1", document_name="Doc 1", retrieval_score=0.75),
    ]
    assert gate.evaluate(candidates) is False

    candidates_high = [
        Evidence(evidence_id="2", document_id="d2", document_name="Doc 2", retrieval_score=0.81),
    ]
    assert gate.evaluate(candidates_high) is True


def test_evidence_gate_dict_input():
    gate = EvidenceGate(min_confidence=0.65)
    dict_candidates = [
        {"evidenceId": "1", "retrievalScore": 0.50},
        {"evidenceId": "2", "retrievalScore": 0.88},
    ]
    assert gate.evaluate(dict_candidates) is True
    filtered = gate.filter_evidence(dict_candidates)
    assert len(filtered) == 1
    assert filtered[0]["evidenceId"] == "2"
