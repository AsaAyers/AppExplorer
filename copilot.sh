#!/bin/bash


# docker build --add-host dev.appexplorer.dev:host-gateway -t asa-copilot . -f Dockerfile.copilot


set -ex
docker run -it \
 --add-host dev.appexplorer.dev:host-gateway \
 --volume "$(cd; pwd)/.copilot:/home/agent/.copilot" \
 --volume "$(pwd):/home/agent/workspace" \
 asa-copilot copilot $@
  

