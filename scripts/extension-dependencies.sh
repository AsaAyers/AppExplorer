#!/bin/sh

DEPENDENCIES=$(rg --no-filename -o "node_modules/[^/]*" app-explorer.cjs | sort -u | cut -d "/" -f 2 | jq -R -s 'split("\n") | map(select(length > 0))')

jq --argjson deps "$DEPENDENCIES" '(.dependencies | with_entries(select(.key as $k | $deps | index($k))))' package.json

