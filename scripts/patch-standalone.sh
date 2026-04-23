#!/bin/sh

set -eux pipefail

cp .next/standalone/server.js .next/standalone/server.original.js

BUILD_END=$(grep -n  __NEXT_PRIVATE_STANDALONE_CONFIG .next/standalone/server.js | head -n 1 | cut -d : -f 1)


head -n $BUILD_END .next/standalone/server.js  > .next/standalone/server.$$.js
grep -Ev  '^(import|declare)' server.js >> .next/standalone/server.$$.js

mv .next/standalone/server.$$.js .next/standalone/server.js

cp *.vsix .next/static/ || true