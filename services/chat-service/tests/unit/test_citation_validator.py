"""Unit tests for CitationValidator."""
import pytest
from app.ai.citation_validator import CitationValidator
from app.domain.value_objects.evidence import Evidence
from app.domain.value_objects.citation import ChatCitation
from app.domain.exceptions import CitationVerificationFailedException


def test_citation_validator_placeholder():
    """Placeholder test preserved for backward compatibility."""
    assert True


def test_extract_citation_indices():
    validator = CitationValidator()
    text = "Theo quy trình tuyển sinh [1], học sinh cần nộp hồ sơ trước hạn [2] hoặc [1]."
    indices = validator.extract_citation_indices(text)
    assert indices == [1, 2]


def test_extract_citation_indices_grouped():
    validator = CitationValidator()
    text = "Nội dung tổng hợp từ các nguồn [1, 2] và bổ sung [3]."
    indices = validator.extract_citation_indices(text)
    assert indices == [1, 2, 3]


def test_extract_citation_indices_empty_or_none():
    validator = CitationValidator()
    assert validator.extract_citation_indices("") == []
    assert validator.extract_citation_indices(None) == []
    assert validator.extract_citation_indices("Câu trả lời không có trích dẫn nguồn.") == []


def test_validate_citations_valid():
    validator = CitationValidator()
    ev1 = Evidence(evidence_id="ev-1", document_id="doc-1", document_name="Doc 1", text="Sample 1", retrieval_score=0.9)
    ev2 = Evidence(evidence_id="ev-2", document_id="doc-2", document_name="Doc 2", text="Sample 2", retrieval_score=0.85)

    answer = "Thông tin phần một [1] và phần hai [2]."
    assert validator.validate_citations(answer, [ev1, ev2]) is True


def test_validate_citations_out_of_bounds():
    validator = CitationValidator()
    ev1 = Evidence(evidence_id="ev-1", document_id="doc-1", document_name="Doc 1", text="Sample 1", retrieval_score=0.9)

    answer = "Thông tin tham khảo từ [2]."
    assert validator.validate_citations(answer, [ev1]) is False


def test_validate_citations_zero_index():
    validator = CitationValidator()
    ev1 = Evidence(evidence_id="ev-1", document_id="doc-1", document_name="Doc 1", text="Sample 1", retrieval_score=0.9)

    answer = "Nguồn trích dẫn [0]."
    assert validator.validate_citations(answer, [ev1]) is False


def test_validate_citations_no_citations_in_answer():
    validator = CitationValidator()
    ev1 = Evidence(evidence_id="ev-1", document_id="doc-1", document_name="Doc 1", text="Sample 1", retrieval_score=0.9)

    answer = "Câu trả lời đúng sự thật nhưng không có trích dẫn nguồn nào."
    assert validator.validate_citations(answer, [ev1]) is False


def test_validate_citations_empty_evidence():
    validator = CitationValidator()
    answer = "Nguồn [1]."
    assert validator.validate_citations(answer, []) is False


def test_build_citations_success():
    validator = CitationValidator()
    ev1 = Evidence(
        evidence_id="ev-alpha",
        document_id="doc-101",
        document_name="Syllabus.pdf",
        document_version=2,
        page_from=5,
        page_to=6,
        text="Môn học bắt đầu vào tháng Chín hàng năm với 3 tín chỉ lý thuyết.",
        retrieval_score=0.92,
        source_type="official",
    )
    ev2 = Evidence(
        evidence_id="ev-beta",
        document_id="doc-102",
        document_name="Regulation.pdf",
        document_version=1,
        page_from=12,
        page_to=12,
        text="Điểm chuyên cần chiếm 10% tổng điểm môn học.",
        retrieval_score=0.88,
        source_type="official",
    )

    answer = "Khóa học có 3 tín chỉ [1] và điểm chuyên cần là 10% [2]."
    citations = validator.build_citations(answer, [ev1, ev2])

    assert len(citations) == 2
    cit1, cit2 = citations

    assert isinstance(cit1, ChatCitation)
    assert cit1.evidence_id == "ev-alpha"
    assert cit1.document_id == "doc-101"
    assert cit1.document_name == "Syllabus.pdf"
    assert cit1.page_from == 5
    assert cit1.page_to == 6
    assert cit1.snippet.startswith("Môn học bắt đầu")
    assert cit1.citation_id.startswith("cit-")

    assert isinstance(cit2, ChatCitation)
    assert cit2.evidence_id == "ev-beta"
    assert cit2.document_id == "doc-102"
    assert cit2.page_from == 12
    assert cit2.page_to == 12


def test_build_citations_out_of_bounds_raises_exception():
    validator = CitationValidator()
    ev1 = Evidence(evidence_id="ev-1", document_id="doc-1", document_name="Doc 1", text="Sample", retrieval_score=0.9)

    answer = "Tham khảo [5]."
    with pytest.raises(CitationVerificationFailedException) as exc_info:
        validator.build_citations(answer, [ev1])
    assert "[5]" in str(exc_info.value)


def test_extract_citation_indices_ignores_markdown_links_and_text():
    validator = CitationValidator()
    text = "Xem chi tiết tại [tài liệu hướng dẫn](https://example.com) và quy chế [1]."
    indices = validator.extract_citation_indices(text)
    assert indices == [1]


def test_extract_citation_indices_handles_whitespace_and_deduplication():
    validator = CitationValidator()
    text = "Theo quy định [ 1 , 2 ] và tham khảo lại [1] cùng [2]."
    indices = validator.extract_citation_indices(text)
    assert indices == [1, 2]


def test_extract_citation_indices_ranges():
    validator = CitationValidator()
    assert validator.extract_citation_indices("Tài liệu [1-3]") == [1, 2, 3]
    assert validator.extract_citation_indices("Tài liệu [1 - 3]") == [1, 2, 3]
    assert validator.extract_citation_indices("Tài liệu [1–3]") == [1, 2, 3]  # en-dash
    assert validator.extract_citation_indices("Tài liệu [1—3]") == [1, 2, 3]  # em-dash
    assert validator.extract_citation_indices("Tài liệu [1 to 3]") == [1, 2, 3]
    assert validator.extract_citation_indices("Hỗn hợp [1, 3-5, 8]") == [1, 3, 4, 5, 8]


def test_extract_citation_indices_roman_numerals():
    validator = CitationValidator()
    assert validator.extract_citation_indices("Nguồn [i]") == [1]
    assert validator.extract_citation_indices("Nguồn [ii, iii]") == [2, 3]
    assert validator.extract_citation_indices("Nguồn [iv-vi]") == [4, 5, 6]
    assert validator.extract_citation_indices("Nguồn [I, II, V]") == [1, 2, 5]


def test_extract_citation_indices_semicolon_and_inverted_range():
    validator = CitationValidator()
    assert validator.extract_citation_indices("Trích dẫn [1; 2; 3]") == [1, 2, 3]
    assert validator.extract_citation_indices("Trích dẫn [3-1]") == [3, 2, 1]


def test_extract_citation_indices_huge_range_guarded():
    validator = CitationValidator()
    # Ranges with span > 50 are ignored to protect against denial-of-service / memory exhaustion
    assert validator.extract_citation_indices("Nguồn [1-1000]") == []


def test_build_citations_enforces_openapi_page_and_snippet_rules():
    validator = CitationValidator()
    ev_empty_text = Evidence(
        evidence_id="ev-empty",
        document_id="doc-1",
        document_name="Regulations.pdf",
        text="",
        page_from=8,
        page_to=3,  # Invalid: page_to < page_from
        retrieval_score=0.9,
    )

    citations = validator.build_citations("Nguồn [1]", [ev_empty_text])
    assert len(citations) == 1
    cit = citations[0]

    # page_to must be >= page_from
    assert cit.page_from == 8
    assert cit.page_to == 8
    assert cit.page_to >= cit.page_from

    # snippet minLength >= 1
    assert len(cit.snippet) > 0
    assert cit.snippet == "Regulations.pdf"


def test_extract_citation_indices_asian_brackets():
    validator = CitationValidator()
    # Lenticular black brackets 【...】
    assert validator.extract_citation_indices("Theo tài liệu 【1】 và 【2】.") == [1, 2]
    assert validator.extract_citation_indices("Theo tài liệu 【1, 3】.") == [1, 3]
    assert validator.extract_citation_indices("Theo tài liệu 【1-3】.") == [1, 2, 3]

    # Fullwidth square brackets ［...］
    assert validator.extract_citation_indices("Tài liệu ［1］ cùng ［2］.") == [1, 2]
    assert validator.extract_citation_indices("Tài liệu ［1, 2］.") == [1, 2]
    assert validator.extract_citation_indices("Tài liệu ［2-4］.") == [2, 3, 4]


def test_extract_citation_indices_round_brackets():
    validator = CitationValidator()
    # At sentence boundary or after word
    assert validator.extract_citation_indices("Thời hạn nộp bài là 15 tháng 12 (1).") == [1]
    assert validator.extract_citation_indices("Khóa học gồm 3 tín chỉ (1, 2).") == [1, 2]
    assert validator.extract_citation_indices("Chi tiết điểm quá trình (1-3).") == [1, 2, 3]
    # Explicit prefix inside parentheses
    assert validator.extract_citation_indices("Theo tài liệu (Source 1), thời gian thi là tuần 16.") == [1]
    assert validator.extract_citation_indices("Theo tài liệu (Doc 2), điểm liệt là 4.") == [2]


def test_extract_citation_indices_ignores_numbered_lists_in_round_brackets():
    validator = CitationValidator()
    # Numbered list items should NOT be falsely parsed as citations
    text = "Các bước thực hiện gồm: (1) Nộp hồ sơ, (2) Chờ xét duyệt, (3) Nhận kết quả."
    assert validator.extract_citation_indices(text) == []


def test_extract_citation_indices_with_citation_prefixes():
    validator = CitationValidator()
    assert validator.extract_citation_indices("Trích từ [Source 1] và [Source 2].") == [1, 2]
    assert validator.extract_citation_indices("Nguồn tham khảo [Doc 3].") == [3]
    assert validator.extract_citation_indices("Theo [Tài liệu 1-3].") == [1, 2, 3]
    assert validator.extract_citation_indices("Theo quy định [#1] và [#2].") == [1, 2]
    assert validator.extract_citation_indices("Tham khảo [Nguồn 4].") == [4]


def test_build_citations_defensive_page_and_source_type_normalization():
    validator = CitationValidator()
    ev_malformed = {
        "evidenceId": "ev-malformed",
        "documentId": "doc-99",
        "documentName": "Guidelines.pdf",
        "text": "   ",  # whitespace only
        "pageFrom": "N/A",  # unparseable string
        "pageTo": "invalid",
        "sourceType": "UNKNOWN_TYPE",
    }
    citations = validator.build_citations("Tham khảo [1].", [ev_malformed])
    assert len(citations) == 1
    cit = citations[0]
    assert cit.page_from == 1
    assert cit.page_to == 1
    assert cit.source_type == "official"
    assert cit.snippet == "Guidelines.pdf"


def test_extract_citation_indices_parenthesized_mid_sentence_and_unspaced():
    """Verify CitationValidator extracts parenthesized citations mid-sentence and unspaced."""
    validator = CitationValidator()
    # Mid-sentence with words after
    text1 = "Môn học có 3 tín chỉ (1) và kiểm tra giữa kỳ chiếm 30% (2)."
    assert validator.extract_citation_indices(text1) == [1, 2]

    # Unspaced within words
    text2 = "nội dung(1)nội dung"
    assert validator.extract_citation_indices(text2) == [1]

    # Preceded by non-word chars like percent
    text3 = "Đạt tỷ lệ 100%(1) theo khảo sát."
    assert validator.extract_citation_indices(text3) == [1]


def test_extract_citation_indices_parenthesized_prefixes():
    """Verify CitationValidator extracts citations with diverse parenthesized prefixes."""
    validator = CitationValidator()
    assert validator.extract_citation_indices("Theo quy định (#1) và (#2).") == [1, 2]
    assert validator.extract_citation_indices("Theo tài liệu (No. 3).") == [3]
    assert validator.extract_citation_indices("Theo (Trích dẫn 4).") == [4]
    assert validator.extract_citation_indices("Theo (Reference 5).") == [5]


def test_validate_citations_rejects_none_candidate_in_list():
    """Verify validate_citations returns False if a cited index maps to a None element."""
    validator = CitationValidator()
    assert validator.validate_citations("Nguồn [1]", [None]) is False


def test_build_citations_float_string_page_numbers():
    """Verify build_citations correctly parses float string page numbers."""
    validator = CitationValidator()
    ev = {
        "evidenceId": "ev-float",
        "documentId": "doc-1",
        "documentName": "Doc.pdf",
        "text": "Sample text",
        "pageFrom": "2.0",
        "pageTo": "4.0",
    }
    cits = validator.build_citations("Tham khảo [1]", [ev])
    assert len(cits) == 1
    assert cits[0].page_from == 2
    assert cits[0].page_to == 4

