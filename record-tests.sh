#!/bin/bash

set -x

export HEADLESS=0
source ./setup-xvfb.sh

recordTests
extractScreenshots

