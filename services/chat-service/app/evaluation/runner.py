"""Evaluation suite runner."""

class EvaluationRunner:
    def __init__(self, dataset_path: str):
        self.dataset_path = dataset_path

    async def run(self):
        raise NotImplementedError
