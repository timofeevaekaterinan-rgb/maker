// Съёмка шагов ролика в прототипе: node capture.js <id> [16x9|9x16|all]
// Нужен сервер maker на :8934. Результат: build/<id>/<fmt>/sNN.jpg + meta.json (координаты цели в пикселях кадра).
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const STEPS = require('./steps.js');
const [, , id, which = 'all'] = process.argv;
const FMT = { '16x9': { w: 1600, h: 900, dsf: 1.2 }, '9x16': { w: 360, h: 640, dsf: 3 } };
const V = STEPS[id];
if (!V) { console.error('нет ролика', id); process.exit(1); }

(async () => {
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--hide-scrollbars', '--force-color-profile=srgb'] });
  for (const fmt of which === 'all' ? Object.keys(FMT) : [which]) {
    const F = FMT[fmt], dir = `build/${id}/${fmt}`;
    fs.mkdirSync(dir, { recursive: true });
    const p = await b.newPage();
    p.on('pageerror', e => console.error('PAGE ERROR', e.message));
    await p.setViewport({ width: F.w, height: F.h, deviceScaleFactor: F.dsf, isMobile: fmt === '9x16', hasTouch: fmt === '9x16' });
    await p.evaluateOnNewDocument(() => {
      try { localStorage.clear(); localStorage.setItem('mk-intro', '1'); localStorage.setItem('mk-tips', '1'); localStorage.setItem('mk-auth', 'in'); localStorage.setItem('mk-state', 'active'); } catch (e) {}
    });
    await p.goto('http://localhost:' + (process.env.MK_PORT || 8934) + '/prototype.html?tut=' + Date.now() + '#/home', { waitUntil: 'load', timeout: 120000 }); await new Promise(r => setTimeout(r, 1500));
    await new Promise(r => setTimeout(r, 1800));
    // без демо-плашки, подсказок и тостов; хелперы для сценариев
    await p.addStyleTag({ content: '#demo-flag,.demo-flag,.tip,.toast{display:none!important}' });
    await p.evaluate(c => {
      window.$ = s => [...document.querySelectorAll(s)].find(e => e.offsetParent || e.getClientRects().length) || null;
      window.$$ = s => [...document.querySelectorAll(s)];
      window.txt = (s, t) => [...document.querySelectorAll(s)].find(e => e.textContent.trim() === t) || null;
      try { tipsEnd(); } catch (e) {}
      if (c) clientSet(c, false, true);
    }, V.client || '');
    const meta = { id, fmt, w: Math.round(F.w * F.dsf), h: Math.round(F.h * F.dsf), title: V.title, group: V.group, next: V.next || '', outro: V.outro || '', intro: V.intro, steps: [] };
    for (let i = 0; i < V.steps.length; i++) {
      const S = V.steps[i];
      if (S.do) { try { await p.evaluate(S.do); } catch (e) { console.error('step', i, 'do:', e.message); } }
      await new Promise(r => setTimeout(r, S.wait || 600));
      let rect = null;
      if (S.t) {
        rect = await p.evaluate(t => {
          let el; try { el = eval(t); } catch (e) { return null; }
          if (!el) return null;
          const r0 = el.getBoundingClientRect();
          // не влезает — небольшой блок ставим по центру; большой — верхом под шапку, если его верх не виден или он ниже середины
          if (r0.top < 60 || r0.bottom > innerHeight - 20) {
            if (r0.height < innerHeight * 0.6) el.scrollIntoView({ block: 'center' });
            else if (r0.top < 60 || r0.top > innerHeight * 0.45) window.scrollBy(0, r0.top - 80);
          }
          return null;
        }, S.t);
        await new Promise(r => setTimeout(r, 350));
        rect = await p.evaluate(t => {
          let el; try { el = eval(t); } catch (e) { return null; }
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left, y: r.top, w: r.width, h: r.height };
        }, S.t);
        if (!rect) console.error('step', i, 'цель не найдена:', S.t);
      }
      const file = `s${String(i).padStart(2, '0')}.jpg`;
      await p.screenshot({ path: `${dir}/${file}`, type: 'jpeg', quality: 90 });
      const k = F.dsf;
      meta.steps.push({ img: file, say: S.say, click: !!S.click, rect: rect && { x: rect.x * k, y: rect.y * k, w: rect.w * k, h: rect.h * k } });
      console.log(fmt, 'шаг', i, rect ? 'ok' : '—');
    }
    fs.writeFileSync(`${dir}/meta.json`, JSON.stringify(meta, null, 1));
    await p.close();
  }
  await b.close();
})();
