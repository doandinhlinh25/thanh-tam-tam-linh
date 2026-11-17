"""Loader for JSONL evaluation datasets."""
import json


class DatasetLoader:
    @staticmethod
    def load(file_path: str) -> list[dict]:
        records = []
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    records.append(json.loads(line))
        return records
