"""Loader for JSONL evaluation datasets."""
import json
from typing import List, Dict

class DatasetLoader:
    @staticmethod
    def load(file_path: str) -> List[Dict]:
        records = []
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    records.append(json.loads(line))
        return records
