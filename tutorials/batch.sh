#!/bin/zsh
# Досборка роликов по очереди: озвучка (если нет) → съёмка (если нет) → оба формата. Лог — build/batch.log
cd "$(dirname "$0")"
for id in "$@"; do
  [ -f build/$id/voice/voice.json ] || node voice.js $id
  [ -f build/$id/9x16/meta.json ] || node capture.js $id all
  node make.js $id all 2>&1 | grep -v кадр
done
echo ВСЁ
