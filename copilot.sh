#!/bin/bash

set -ex
docker run --rm -it \
 --volume "$(pwd):/home/agent/workspace" \
 $(docker build -q . -f Dockerfile.copilot)
  

