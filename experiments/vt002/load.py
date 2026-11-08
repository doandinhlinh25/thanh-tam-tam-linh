"""200 synchronized in-process callers, synthetic data, no external network."""
import asyncio
import json
import math
from pathlib import Path
import platform
import sys
from time import perf_counter
from support import fixture

COUNT = 200
TARGET_SECONDS = 5.0


async def workload(name, duplicate):
    repository, backend, _, api = fixture()
    start = asyncio.Event()
    all_ready = asyncio.Event()
    ready = active = peak = 0

    async def caller(index):
        nonlocal ready, active, peak
        ready += 1
        if ready == COUNT:
            all_ready.set()
        await start.wait()
        active += 1
        peak = max(peak, active)
        before = perf_counter()
        response = await api.post(("tenant-load", "user-load", "course-load"),
                                  "same-key" if duplicate else f"key-{index}",
                                  {"question": "Synthetic course question", "include_personal_docs": False})
        elapsed = perf_counter() - before
        active -= 1
        return elapsed, response

    tasks = [asyncio.create_task(caller(index)) for index in range(COUNT)]
    await all_ready.wait()
    before = perf_counter()
    start.set()
    outcomes = await asyncio.gather(*tasks)
    wall = perf_counter() - before
    samples = sorted(elapsed for elapsed, _ in outcomes)
    assert all(response["status"] == 200 for _, response in outcomes)
    expected = 1 if duplicate else COUNT
    assert repository.commits == expected and len(repository.rows) == expected
    p95 = samples[math.ceil(0.95 * len(samples)) - 1]  # nearest rank, n=200 -> index 189
    return {"name": name, "requests": COUNT, "peak_inflight_callers": peak,
            "peak_fake_backend_operations": backend.max_active, "backend_calls": backend.calls,
            "committed_rows": repository.commits, "successes": COUNT,
            "p50_ms": samples[math.ceil(0.5 * len(samples)) - 1] * 1000,
            "p95_ms": p95 * 1000, "max_ms": max(samples) * 1000,
            "wall_ms": wall * 1000, "target_p95_ms": TARGET_SECONDS * 1000,
            "within_simulated_target": p95 <= TARGET_SECONDS,
            "samples_ms_sorted": [value * 1000 for value in samples]}


async def main():
    report = {"python": sys.version.split()[0], "platform": platform.platform(),
              "model": "Single asyncio event loop; fake RAG yields once; in-memory atomic repository.",
              "limitations": "No HTTP sockets, auth, real DB, LLM, process crash, or production SLO proof.",
              "workloads": [await workload("200 unique keys", False),
                            await workload("200 simultaneous same-key retries", True)]}
    output = Path(__file__).parent / "evidence" / "load.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    for item in report["workloads"]:
        print(json.dumps({key: value for key, value in item.items() if key != "samples_ms_sorted"}))


if __name__ == "__main__":
    asyncio.run(main())
