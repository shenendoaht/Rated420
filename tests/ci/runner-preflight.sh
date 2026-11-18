#!/usr/bin/env bash
set -euo pipefail

minimum_gib=$1
available_kib=$(df -Pk "$PWD" | awk 'NR == 2 {print $4}')
df -h "$PWD"
if (( available_kib < minimum_gib * 1024 * 1024 )); then
  echo "Runner needs at least ${minimum_gib} GiB free before test setup." >&2
  exit 1
fi
git log -1 --format='Testing commit %H, tree %T'
