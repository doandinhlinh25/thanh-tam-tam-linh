"""Exports evaluation results to CSV format."""
import csv

class CsvReporter:
    @staticmethod
    def export(records: list, filepath: str):
        if not records:
            return
        keys = records[0].keys()
        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(records)
