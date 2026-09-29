#!/bin/bash
# Fast local type-check of the iOS app against the Mac Catalyst SDK — works with just the Command Line Tools.
# The real iOS build happens in Xcode / CI; this catches most errors in seconds.
set -euo pipefail
cd "$(dirname "$0")/.."
SDK=$(xcrun --show-sdk-path)
swiftc -typecheck -sdk "$SDK" -target arm64-apple-ios17.0-macabi \
  -Fsystem "$SDK/System/iOSSupport/System/Library/Frameworks" \
  -I "$SDK/System/iOSSupport/usr/lib/swift" \
  -swift-version 5 \
  $(find Strive -name '*.swift') "$@"
echo "typecheck ok"
