"""Capture a real test run. RED expects failing assertions, GREEN expects zero exit."""
import argparse
from pathlib import Path
import subprocess
import sys
import os

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--phase", choices=("red", "green", "mutation"), default="green")
args = parser.parse_args()
command = [sys.executable, "-m", "unittest", "discover", "-s", "experiments/vt002", "-p", "test_*.py", "-v"]
env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "utf-8"}
result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", env=env)
content = f"phase={args.phase}\ncommand={' '.join(command)}\nexit_code={result.returncode}\n" + result.stdout + result.stderr
output = ROOT / "experiments/vt002/evidence" / f"{args.phase}.log"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(content, encoding="utf-8")
print(content)
expected_failure = args.phase in ("red", "mutation")
if expected_failure:
    # Do not mistake a missing dependency/import error for a meaningful RED.
    assert result.returncode != 0 and "FAIL:" in content, "Expected an assertion failure"
    assert "ModuleNotFoundError" not in content
else:
    assert result.returncode == 0, "Expected GREEN"
