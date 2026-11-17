"""Domain-level specific exceptions."""

class DomainException(Exception):
    """Base domain exception."""

class InsufficientEvidenceException(DomainException):
    """Raised when retrieval evidence is inadequate to safely answer."""

class CitationVerificationFailedException(DomainException):
    """Raised when citations cannot be verified against context."""
