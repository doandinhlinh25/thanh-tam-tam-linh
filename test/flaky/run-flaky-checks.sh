#!/usr/bin/env bash
# Kiểm tra nguy cơ flaky cho test import ghi danh (BT3 VT-004).
#  1. ORDER/SHARED STATE: chạy từng test riêng lẻ (không có test trước để "dọn đường").
#  2. CONCURRENCY: lặp IT-08 (5 lô đồng thời, transaction retry) nhiều lần.
#  3. TIME: chạy cả suite dưới 2 múi giờ cực trị (UTC+14 và UTC-12).
#  4. REPEAT: lặp toàn bộ suite để phát hiện kết quả không ổn định.
# Dùng: bash test/flaky/run-flaky-checks.sh [số lần lặp suite] [số lần lặp IT-08]
set -u
SUITE_RUNS="${1:-10}"
CONCURRENCY_RUNS="${2:-20}"
FILE="test/enrollment-import.integration.ts"
fail=0

run() {
  local label="$1"
  shift
  if "$@" > /tmp/bt3-flaky-last.log 2>&1; then
    echo "PASS | $label"
  else
    echo "FAIL | $label"
    grep -E "^✖" /tmp/bt3-flaky-last.log | head -5
    fail=$((fail + 1))
  fi
}

echo "== 1. Isolation (order/shared state) =="
for id in IT-01 IT-02 IT-03 IT-04 IT-05 IT-06 IT-07 IT-08 IT-R1 IT-R2; do
  run "only $id" npx tsx --test --test-concurrency=1 --test-name-pattern="^$id " "$FILE"
done

echo "== 2. Concurrency: IT-08 x $CONCURRENCY_RUNS =="
for i in $(seq 1 "$CONCURRENCY_RUNS"); do
  run "IT-08 run $i" npx tsx --test --test-concurrency=1 --test-name-pattern="^IT-08 " "$FILE"
done

echo "== 3. Time zones =="
for tz in Pacific/Kiritimati Etc/GMT+12; do
  run "TZ=$tz" env TZ="$tz" npx tsx --test --test-concurrency=1 "$FILE"
done

echo "== 4. Repeat full suite x $SUITE_RUNS =="
for i in $(seq 1 "$SUITE_RUNS"); do
  run "suite run $i" npx tsx --test --test-concurrency=1 "$FILE"
done

echo "TOTAL FAILURES: $fail"
exit "$fail"
