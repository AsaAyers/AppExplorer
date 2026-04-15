#!/bin/bash


# docker build -t asa-copilot . -f Dockerfile.copilot


set -ex
docker run -it \
 --volume "$(cd; pwd)/.copilot:/home/agent/.copilot" \
 --volume "$(pwd):/home/agent/workspace" \
 asa-copilot
  

