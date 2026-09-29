#!/bin/bash
# Builds and runs the contract check (app Models + API client vs. a running Strive API). macOS only, no Xcode needed.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${TMPDIR:-/tmp}/strive-contract-check"
swiftc -O -parse-as-library -swift-version 5 -target arm64-apple-macosx14.0 \
  Strive/Core/Theme.swift Strive/Core/Models.swift Strive/Core/API.swift scripts/ContractCheck/main.swift -o "$OUT"
"$OUT"
