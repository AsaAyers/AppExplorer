#!/bin/sh

set -ex

BUILD_END=$(grep -n  __NEXT_PRIVATE_STANDALONE_CONFIG .next/standalone/server.js | cut -d : -f 1)


head -n $BUILD_END .next/standalone/server.js  > .next/standalone/server.$$.js
grep -Ev  '^(import|declare)' server.ts >> .next/standalone/server.$$.js  

mv .next/standalone/server.$$.js .next/standalone/server.js  