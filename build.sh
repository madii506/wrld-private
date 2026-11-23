#!/bin/sh
# bundles the page scripts; rings.js (Privacy Rings SDK) is its own lazy chunk
set -e
cd "$(dirname "$0")"
npx esbuild src/home.js --bundle --format=esm --minify --target=es2020 --outfile=assets/js/home.js
[ -f src/app.js ] && npx esbuild src/app.js --bundle --format=esm --minify --target=es2020 --outfile=assets/js/app.js
[ -f src/rings-entry.js ] && npx esbuild src/rings-entry.js --bundle --format=esm --platform=browser --minify --target=es2022 --outfile=assets/js/rings.js
true
