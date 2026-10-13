#!/bin/zsh
# Досборка роликов по очереди: озвучка (если нет) → съёмка (если нет) → оба формата. Лог — build/batch.log
cd "$(dirname "$0")"
# свой сервер на время сборки (сервер превью отключается, когда сессия простаивает)
export MK_PORT=8935
(cd .. && exec python3 -m http.server $MK_PORT >/dev/null 2>&1) & SRV=$!
trap "kill $SRV 2>/dev/null" EXIT
sleep 2
# не даём ноуту уснуть от бездействия, пока идёт пачка
caffeinate -i -w $$ & 
for id in "$@"; do
  # сервер прототипа должен отвечать, иначе ждём, а не гоним пустые сборки
  until curl -s -o /dev/null http://localhost:$MK_PORT/prototype.html; do echo "жду сервер :$MK_PORT"; sleep 60; done
  [ -f build/$id/voice/voice.json ] || node voice.js $id
  [ -f build/$id/9x16/meta.json ] || node capture.js $id all
  node make.js $id all 2>&1 | grep -v кадр
  sleep ${PAUSE:-90}  # щадим ноут: пауза между роликами
done
echo ВСЁ
