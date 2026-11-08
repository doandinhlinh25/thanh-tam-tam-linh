"""VT-002 RED scaffold: validate inputs but perform every request again.

This intentionally naive pre-patch version makes replay tests fail for the
correct behavioral reason. It will be replaced by the reviewed small patch.
"""
MAX_QUESTION_LENGTH = 4000


class IdempotencyError(Exception):
    """Stable HTTP-shaped error for the standalone harness boundary."""
    def __init__(self, status, code):
        super().__init__(code)
        self.status = status
        self.code = code


class IdempotencyCoordinator:
    def __init__(self, repository, operation):
        self.repository = repository
        self.operation = operation

    async def execute(self, scope, key, payload):
        question = payload.get("question")
        if not isinstance(question, str) or not question or len(question) > MAX_QUESTION_LENGTH:
            raise IdempotencyError(400, "INVALID_QUESTION")
        if not isinstance(key, str) or not key or len(key) > 64 or not all(
            char.isascii() and (char.isalnum() or char in "-_") for char in key
        ):
            raise IdempotencyError(400, "INVALID_KEY")
        return await self.operation(scope, payload)
