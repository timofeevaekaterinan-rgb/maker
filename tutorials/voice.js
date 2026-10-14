// Озвучка нейроголосом «Светлана» (Microsoft, edge-tts): node voice.js <id> → build/<id>/voice/iNN.wav + voice.json (длительности, с)
// Нужен .venv с edge-tts: python3 -m venv .venv && ./.venv/bin/pip install edge-tts
const { execSync } = require('child_process');
const fs = require('fs');
const V = require('./steps.js')[process.argv[2]];
const dir = `build/${process.argv[2]}/voice`;
const VOICE = 'ru-RU-SvetlanaNeural', RATE = '+5%';
fs.mkdirSync(dir, { recursive: true });
const lines = [V.intro].concat(V.steps.map(s => s.say)).concat(V.next ? ['Дальше — ' + V.next + '.'] : []);
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const out = [];
lines.forEach((t, i) => {
  const base = `${dir}/i${String(i).padStart(2, '0')}`;
  const say = t.replace(/[«»]/g, '').replace(/(^|\s)к Maker/g, '$1к Мейкеру').replace(/Maker/g, 'Мейкер').replace(/\bVK\b/g, 'ВКонтакте').replace(/Telegram/g, 'Телеграм').replace(/TenChat/g, 'ТенЧат').replace(/\berid\b/gi, 'ерид').replace(/\bVPN\b/g, 'ВиПиЭн').replace(/(^|[^А-Яа-яЁё])КП(?![А-Яа-яЁё])/g, '$1КаПэ').replace(/\bHR\b/g, 'эйч-ар');
  // уже озвучено тем же текстом — не трогаем (перезапуск после сбоя докачивает только недостающее)
  const done = fs.existsSync(base + '.wav') && fs.existsSync(base + '.txt') && fs.readFileSync(base + '.txt', 'utf8') === say;
  if (!done) fs.writeFileSync(base + '.txt', say);
  // сервис иногда отвечает 403 — повторяем с растущей паузой
  for (let k = 0; !done; k++) {
    try { execSync(`./.venv/bin/edge-tts --voice ${VOICE} --rate=${RATE} -f "${base}.txt" --write-media "${base}.mp3"`, { stdio: 'ignore' }); if (fs.statSync(base + '.mp3').size > 1000) break; } catch (e) {}
    if (k >= 8) throw new Error('озвучка не получилась: ' + base);
    sleep(5000 * (k + 1));
  }
  // тишину по краям срезаем — паузы задаёт make.js
  if (!done) execSync(`ffmpeg -y -loglevel error -i "${base}.mp3" -af "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse" -ar 48000 -ac 1 "${base}.wav"`);
  const d = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${base}.wav"`).toString());
  out.push({ file: base.split('/').pop() + '.wav', text: t, dur: d });
});
fs.writeFileSync(`${dir}/voice.json`, JSON.stringify(out, null, 1));
console.log(out.map(x => x.dur.toFixed(1)).join(' '));
