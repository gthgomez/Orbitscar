#!/usr/bin/env bash
set -euo pipefail
# Run from the repository root after capture-showcase.mjs.
input="docs/showcase/raw/session.webm"
output="docs/showcase"
test -f "docs/showcase/capture.json" # encode only a successfully asserted capture
mkdir -p "$output"
ffmpeg -hide_banner -loglevel error -y -i "$input" -vf 'fps=20,scale=960:-2' -c:v libx264 -crf 28 -preset medium -pix_fmt yuv420p -an -movflags +faststart "$output/gameplay.mp4"
# A short, reduced-resolution excerpt; full recording remains in the MP4.
ffmpeg -hide_banner -loglevel error -y -ss 5 -t 3 -i "$input" -filter_complex '[0:v]fps=5,scale=480:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=48[p];[b][p]paletteuse=dither=bayer' -loop 0 "$output/preview.gif"
