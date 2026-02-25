#!/bin/bash

# scripts/package.sh
# Bundles the Coupon Wallet project into a clean zip archive suitable for sharing,
# excluding all local caches, build artifacts, node modules, and hidden metadata.

# Name of the output file
ZIP_NAME="coupon-wallet-release.zip"

echo "🧹 Cleaning up old release if exists..."
rm -f "$ZIP_NAME"

echo "📦 Packaging project into $ZIP_NAME..."
zip -r "$ZIP_NAME" . \
    -x "node_modules/*" \
    -x "backend/node_modules/*" \
    -x ".git/*" \
    -x ".npm/*" \
    -x ".npm-cache/*" \
    -x ".expo/*" \
    -x "android/.gradle/*" \
    -x "android/app/build/*" \
    -x "ios/Pods/*" \
    -x "ios/build/*" \
    -x "*/.cache/*" \
    -x ".DS_Store" \
    -x "dist/*" \
    -x "build/*" \
    -x "*.zip"

echo "✅ Packaging complete: $ZIP_NAME"
