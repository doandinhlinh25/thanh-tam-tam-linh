"""Deterministic strength-2 design; independent coverage verifier."""
from itertools import combinations, product

FACTORS = ("tenant", "question_length", "schedule", "personal_docs")
ROWS = tuple((a, b, c, a ^ b ^ c) for a, b, c in product((0, 1), repeat=3))


def uncovered_pairs(rows=ROWS):
    """Return missing value pairs; an empty result proves strength 2 only."""
    missing = []
    for left, right in combinations(range(len(FACTORS)), 2):
        observed = {(row[left], row[right]) for row in rows}
        for values in product((0, 1), repeat=2):
            if values not in observed:
                missing.append((FACTORS[left], FACTORS[right], values))
    return missing


if __name__ == "__main__":
    assert not uncovered_pairs()
    print("8 rows; 4 binary factors; all 24 factor/value pairs covered")
    for index, row in enumerate(ROWS, 1):
        print(f"T{index:02}: {row}")
