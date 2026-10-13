// Скриншоты кабинета для презентации: node shots.js  (нужен tutorials/node_modules; свой сервер на :8936)
const puppeteer = require('../tutorials/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const PORT = 8936;
const SHOTS = [
  // имя, ширина, высота, масштаб, клиент, действие, [прокрутка к элементу]
  ['home', 1440, 900, 2, 'Вита', "go('home')"],
  ['strat', 1440, 900, 2, 'Вита', "go('strat');strSet('Вита')"],
  ['plan', 1440, 900, 2, 'Вита', "go('plan')"],
  ['posts', 1440, 900, 2, 'Вита', "go('soc-post')"],
  ['images', 1440, 900, 2, 'Вита', "go('images')"],
  ['banners', 1440, 900, 2, 'СберТаргет', "go('banners')", "#bn-editor"],
  ['inbox', 1440, 900, 2, 'Вита', "go('inbox')"],
  ['result', 1440, 900, 2, 'Вита', "go('result');rsTab('soc')"],
  ['facts', 1440, 900, 2, 'Вита', "go('facts')"],
  ['agents', 1440, 900, 2, 'Вита', "go('images');dockToggle(true);setTimeout(function(){dockAgMenu({stopPropagation(){},currentTarget:document.querySelector('.dock-ag')})},300)"],
  ['fin', 1440, 900, 2, '', "go('fin')"],
  ['m-home', 390, 844, 3, 'Вита', "go('home')"],
  ['m-post', 390, 844, 3, 'Вита', "go('soc-post');if(typeof psPane==='function')psPane('art')"],
];
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: '..', stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--hide-scrollbars', '--force-color-profile=srgb'] });
  try {
    for (const [name, w, h, dsf, client, act, scrollTo] of SHOTS) {
      const p = await b.newPage();
      const mob = w < 600;
      await p.setViewport({ width: w, height: h, deviceScaleFactor: dsf, isMobile: mob, hasTouch: mob });
      await p.evaluateOnNewDocument(() => { localStorage.clear(); localStorage.setItem('mk-intro', '1'); localStorage.setItem('mk-tips', '1'); localStorage.setItem('mk-auth', 'in'); localStorage.setItem('mk-state', 'active'); });
      await p.goto(`http://localhost:${PORT}/prototype.html#/home`, { waitUntil: 'load', timeout: 120000 });
      await new Promise(r => setTimeout(r, 1800));
      await p.addStyleTag({ content: '#demo-flag,.demo-flag,.tip,.toast,.dock-hint{display:none!important}' });
      await p.evaluate((c, a) => { try { tipsEnd(); } catch (e) {} if (c) clientSet(c, false, true); eval(a); }, client, act);
      await new Promise(r => setTimeout(r, 1300));
      if (scrollTo) await p.evaluate(s => { const e = document.querySelector(s); if (e) window.scrollBy(0, e.getBoundingClientRect().top - 24); }, scrollTo);
      await new Promise(r => setTimeout(r, 500));
      await p.screenshot({ path: `shots/${name}.jpg`, type: 'jpeg', quality: 82 });
      console.log('ok', name);
      await p.close();
    }
  } finally { await b.close(); srv.kill(); }
})();
