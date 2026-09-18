#!/usr/bin/env bash
# 从 demo1.mp4 重新生成分析用帧序列（.gitignore 忽略的中间产物）。
#   frames/       39 帧  f_001..f_039  (fps=2，标定/拟合的主采样)
#   frames_dense/ 118 帧 d_001..d_118  (fps=6，密集扫描)
# 依赖：ffmpeg/ffprobe（macOS: brew install ffmpeg）
set -euo pipefail
cd "$(dirname "$0")/.."

VIDEO=demo1.mp4
command -v ffmpeg >/dev/null || { echo '需要 ffmpeg（brew install ffmpeg）'; exit 1; }

echo "== 视频信息 =="
ffprobe -v error -select_streams v:0 -show_entries format=duration \
  -show_entries stream=avg_frame_rate,width,height -of default=noprint_wrappers=1 "$VIDEO"

mkdir -p frames frames_dense
ffmpeg -v error -i "$VIDEO" -vf fps=2 frames/f_%03d.png
ffmpeg -v error -i "$VIDEO" -vf fps=6 frames_dense/d_%03d.png

echo "== 完成 =="
echo "frames/ $(ls frames | wc -l | tr -d ' ') 帧, frames_dense/ $(ls frames_dense | wc -l | tr -d ' ') 帧"
echo "（参考数量：39 / 118；个别 ffmpeg 版本可能有 ±1 帧差异，不影响分析）"
