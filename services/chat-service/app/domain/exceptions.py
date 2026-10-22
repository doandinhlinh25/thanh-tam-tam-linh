"""Domain-level specific exceptions."""

class DomainException(Exception):
    """Base domain exception."""
    pass

class InsufficientEvidenceException(DomainException):
    """Raised when retrieval evidence is inadequate to safely answer."""
    pass

class CitationVerificationFailedException(DomainException):
    """Raised when citations cannot be verified against context."""
    pass
