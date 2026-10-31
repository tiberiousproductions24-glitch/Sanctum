#!/usr/bin/env bash
# Builds bridge/native/sanctum-link-relay against the Ableton Link SDK (header-only + asio).
# LINK_DIR defaults to ./link (git clone --recursive https://github.com/Ableton/link.git)
set -euo pipefail
cd "$(dirname "$0")"
LINK_DIR="${LINK_DIR:-$PWD/link}"
if [ ! -d "$LINK_DIR/include/ableton" ]; then
  git clone --depth 1 --recursive --shallow-submodules https://github.com/Ableton/link.git "$LINK_DIR"
fi
g++ -std=c++17 -O2 -DLINK_PLATFORM_LINUX=1 \
  -I"$LINK_DIR/include" -I"$LINK_DIR/modules/asio-standalone/asio/include" \
  link-relay.cpp -o sanctum-link-relay -lpthread
echo "built $(pwd)/sanctum-link-relay"
