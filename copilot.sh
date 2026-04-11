#!/bin/bash

set -ex
docker run -it \
 --volume "$(pwd):/home/agent/workspace" \
 $(docker build -q . -f Dockerfile.copilot)
  

