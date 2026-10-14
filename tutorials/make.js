// Сборка ролика: node make.js <id> [16x9|9x16|all] [fps]
// Берёт build/<id>/<fmt>/meta.json (capture.js) и build/<id>/voice/voice.json (voice.js),
// пишет timeline.json, снимает кадры player.html, сводит голос и музыку → out/<id>-<fmt>.mp4
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { execSync } = require('child_process');
const [, , id, which = 'all', FPS = '25'] = process.argv;
const fps = +FPS;
const voice = JSON.parse(fs.readFileSync(`build/${id}/voice/voice.json`));
const PACE = (require('./steps.js')[id] || {}).pace || 1;  // темп: паузы между фразами и экранами

function parts(text, d) {
  // субтитр — по фразам, не длиннее ~85 знаков; время — пропорционально длине
  let ch = text.split(/(?<=[.!?])\s+/);
  ch = ch.flatMap(c => c.length > 85 ? c.split(/(?<=[:—,])\s+/).reduce((a, x) => { if (a.length && (a[a.length - 1] + ' ' + x).length <= 85) a[a.length - 1] += ' ' + x; else a.push(x); return a; }, []) : [c]);
  const tot = ch.reduce((a, c) => a + c.length, 0);
  return ch.map(c => ({ t: c, d: d * c.length / tot }));
}
function timeline(meta) {
  const segs = []; let t = 0;
  const v0 = voice[0];
  segs.push({ type: 'intro', start: 0, dur: Math.max(3.2 * PACE, v0.dur + 1.3 * PACE), vs: 0.5 * PACE, v: v0.file, parts: [] }); t = segs[0].dur;
  meta.steps.forEach((s, k) => {
    const v = voice[k + 1], dur = Math.max(3 * PACE, v.dur + 1.7 * PACE);
    segs.push({ type: 'step', k, start: t, dur, vs: t + 0.7 * PACE, v: v.file, parts: parts(s.say, v.dur) }); t += dur;
  });
  const vl = voice[meta.steps.length + 1];
  const od = vl ? Math.max(3 * PACE, vl.dur + 1.6 * PACE) : 3 * PACE;
  segs.push({ type: 'outro', start: t, dur: od, vs: t + 0.5 * PACE, v: vl ? vl.file : null, parts: [] }); t += od;
  return { meta, segs, total: t };
}

(async () => {
  fs.mkdirSync('out', { recursive: true });
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--hide-scrollbars', '--force-color-profile=srgb'] });
  for (const fmt of which === 'all' ? ['16x9', '9x16'] : [which]) {
    const meta = JSON.parse(fs.readFileSync(`build/${id}/${fmt}/meta.json`));
    const TL = timeline(meta);
    fs.writeFileSync(`build/${id}/${fmt}/timeline.json`, JSON.stringify(TL));
    const fr = `frames/${id}-${fmt}`;
    fs.rmSync(fr, { recursive: true, force: true }); fs.mkdirSync(fr, { recursive: true });
    const p = await b.newPage();
    p.on('pageerror', e => console.error('PAGE ERROR', e.message));
    await p.setViewport({ width: meta.w, height: meta.h, deviceScaleFactor: 1 });
    await p.goto(`http://localhost:${process.env.MK_PORT || 8934}/tutorials/player.html?id=${id}&fmt=${fmt}&capture`, { waitUntil: 'networkidle0' });
    await p.evaluate(() => ready());
    const n = Math.ceil(TL.total * fps);
    for (let f = 0; f < n; f++) {
      await p.evaluate(t => render(t), f / fps);
      await p.screenshot({ path: `${fr}/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 });
      if (f % 250 === 0) console.log(fmt, 'кадр', f, '/', n);
    }
    await p.close();
    // звук: голос по сегментам + тихая музыка
    const vo = TL.segs.filter(s => s.v);
    const ins = vo.map(s => `-i build/${id}/voice/${s.v}`).join(' ');
    const music = '../promo/music_ui_soft.wav';
    const hasMusic = fs.existsSync(music);
    const dl = vo.map((s, i) => `[${i}:a]adelay=${Math.round(s.vs * 1000)}|${Math.round(s.vs * 1000)},volume=1.0[v${i}]`).join(';');
    const mix = vo.map((_, i) => `[v${i}]`).join('') + `amix=inputs=${vo.length}:normalize=0[vv]`;
    const mus = hasMusic ? `;[${vo.length}:a]volume=0.07,afade=t=in:d=1,afade=t=out:st=${(TL.total - 1.5).toFixed(2)}:d=1.5[mm];[vv][mm]amix=inputs=2:normalize=0,atrim=0:${TL.total.toFixed(2)}[a]` : `;[vv]atrim=0:${TL.total.toFixed(2)}[a]`;
    execSync(`ffmpeg -y -loglevel error ${ins} ${hasMusic ? `-stream_loop -1 -i ${music}` : ''} -filter_complex "${dl};${mix}${mus}" -map "[a]" -ar 48000 build/${id}/${fmt}/audio.wav`);
    execSync(`ffmpeg -y -loglevel error -framerate ${fps} -i ${fr}/f%05d.jpg -i build/${id}/${fmt}/audio.wav -threads 2 -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart out/${id}-${fmt}.mp4`);
    fs.rmSync(fr, { recursive: true, force: true });
    console.log('готово', `out/${id}-${fmt}.mp4`, TL.total.toFixed(1) + ' с');
  }
  await b.close();
})();
