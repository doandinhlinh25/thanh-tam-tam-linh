"""Exports evaluation results to JSON format."""
import json

class JsonReporter:
    @staticmethod
    def export(results: dict, filepath: str):
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
