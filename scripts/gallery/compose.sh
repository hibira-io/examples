#!/bin/bash
# compose.sh <work dir> <out.mp4> [skip seconds]
# Puts the two recordings from record.cjs side by side with a 6 px brand
# divider, keeps 25 fps, encodes muted H.264 with faststart, and writes the
# poster (the last frame) next to it as .webp.
set -euo pipefail
d=$1; out=$2; skip=${3:-0}
read -r L R LS RS DUR W H < <(python3 -c "
import json;t=json.load(open('$d/timing.json'));s=$skip
print(t['left'],t['right'],t['leftStart']+s,t['rightStart']+s,t['duration']-s,t['leftWidth'],t['height'])")
ffmpeg -v error -y -ss "$LS" -t "$DUR" -i "$L" -ss "$RS" -t "$DUR" -i "$R" -filter_complex \
  "[0:v]fps=25,pad=$((W + 6)):$H:0:0:0x5b4bff[a];[1:v]fps=25[b];[a][b]hstack=inputs=2,format=yuv420p[v]" \
  -map "[v]" -an -c:v libx264 -preset veryslow -tune animation -crf 31 -r 25 -movflags +faststart "$out"
ffmpeg -v error -y -sseof -0.1 -i "$out" -frames:v 1 -c:v libwebp -quality 78 "${out%.mp4}.webp"
