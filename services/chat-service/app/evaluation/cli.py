"""Evaluation CLI interface for executing test suites on datasets."""
import argparse

def parse_args():
    parser = argparse.ArgumentParser(description="Run RAG Evaluation Suite")
    parser.add_argument("--dataset", type=str, default="dev", help="Dataset name (dev or test)")
    parser.add_argument("--output", type=str, default="reports/eval_results.json", help="Output report file")
    return parser.parse_args()
