#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd -- "${script_dir}/.." && pwd)"
source_path="${root_dir}/public/AppExplorer.svg"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required but was not found on PATH" >&2
  exit 1
fi

if [[ ! -f "${source_path}" ]]; then
  echo "SVG source not found: ${source_path}" >&2
  exit 1
fi

sizes=(128 256)

for size in "${sizes[@]}"; do
  output_path="${root_dir}/public/logo-${size}x${size}.png"

  ffmpeg \
    -hide_banner \
    -loglevel error \
    -y \
    -i "${source_path}" \
    -vf "scale=${size}:${size}:flags=lanczos" \
    "${output_path}"

  echo "Wrote ${output_path#"${root_dir}/"}"
done