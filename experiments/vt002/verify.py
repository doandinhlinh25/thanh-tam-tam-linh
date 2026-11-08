"""Repeat shuffled suites and optionally record coverage.py line/branch data."""
from pathlib import Path
import importlib.util
import json
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "experiments/vt002/evidence"
EVIDENCE.mkdir(exist_ok=True)
BASE = [sys.executable, "-m", "unittest", "discover", "-s", "experiments/vt002", "-p", "test_*.py", "-v"]
environment = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "utf-8"}
results = []
for seed in range(5):
    result = subprocess.run(BASE, cwd=ROOT, capture_output=True, text=True, encoding="utf-8",
                            env={**environment, "VT002_TEST_ORDER_SEED": str(seed)})
    (EVIDENCE / f"order-{seed}.log").write_text(
        f"order_seed={seed}\nexit_code={result.returncode}\n" + result.stdout + result.stderr, encoding="utf-8")
    results.append({"seed": seed, "exit_code": result.returncode})
    assert result.returncode == 0, f"Suite failed with order seed {seed}"
(EVIDENCE / "order-summary.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
print("5 shuffled-order runs passed; each used a fresh subprocess and fresh per-test fixtures.")

if importlib.util.find_spec("coverage") is not None:
    coverage_env = {**environment, "COVERAGE_FILE": str(EVIDENCE.parent / ".coverage")}
    commands = [
        [sys.executable, "-m", "coverage", "run", "--branch", "--include=*/app/services/idempotency.py",
         "-m", "unittest", "discover", "-s", "experiments/vt002", "-p", "test_*.py"],
        [sys.executable, "-m", "coverage", "report", "-m"],
        [sys.executable, "-m", "coverage", "json", "-o", str(EVIDENCE / "coverage.json")],
    ]
    captured = []
    for command in commands:
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", env=coverage_env)
        captured.append(f"command={' '.join(command)}\nexit_code={result.returncode}\n{result.stdout}{result.stderr}")
        assert result.returncode == 0
    (EVIDENCE / "coverage.log").write_text("\n".join(captured), encoding="utf-8")
    print(captured[1])
else:
    print("coverage.py unavailable: branch/line measurement skipped; functional evidence remains available.")
