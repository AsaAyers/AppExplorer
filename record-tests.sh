#!/bin/bash

# set -x


source ./setup-xvfb.sh
DEBUG='app-explorer:*' recordTests "$@"
extractScreenshots

