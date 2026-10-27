#!/bin/sh
set -eu
ready=0
for attempt in $(seq 1 90); do
  if mc alias set sandbox http://s3:9000 "$S3_ACCESS_KEY" "$S3_SECRET_KEY" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
[ "$ready" -eq 1 ] || { echo "Sandbox S3 did not become ready"; exit 1; }
mc mb --ignore-existing "sandbox/$DOCUMENT_S3_BUCKET" >/dev/null
mc anonymous set none "sandbox/$DOCUMENT_S3_BUCKET" >/dev/null
echo "Sandbox private S3 bucket ready"
