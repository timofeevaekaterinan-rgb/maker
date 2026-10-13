// Подсказка для сценариев: что видно на экране раздела — блоки, кнопки, заголовки.
// node dump.js <вид> [вид…]   клиент — env CLIENT (по умолчанию «Вита»), порт — env MK_PORT (8934)
const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 900 });
  await p.evaluateOnNewDocument(() => { localStorage.clear(); localStorage.setItem('mk-intro', '1'); localStorage.setItem('mk-tips', '1'); localStorage.setItem('mk-auth', 'in'); localStorage.setItem('mk-state', 'active'); });
  await p.goto(`http://localhost:${process.env.MK_PORT || 8934}/prototype.html#/home`, { waitUntil: 'load', timeout: 120000 });
  await new Promise(r => setTimeout(r, 1500));
  for (const v of process.argv.slice(2)) {
    const out = await p.evaluate((v, c) => {
      try { tipsEnd(); } catch (e) {}
      if (c) clientSet(c, false, true);
      go(v);
      const V = document.querySelector('.view.on'), vis = e => e.offsetParent, t = (e, n) => e.textContent.trim().replace(/\s+/g, ' ').slice(0, n);
      return {
        v,
        kids: [...V.children].filter(vis).map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + [...e.classList].join('.') + ' :: ' + t(e, 70)),
        btn: [...V.querySelectorAll('button')].filter(vis).slice(0, 25).map(e => [...e.classList].join('.') + ' :: ' + t(e, 40)),
        h: [...V.querySelectorAll('h2,h3')].filter(vis).slice(0, 12).map(e => t(e, 50)),
        ids: [...V.querySelectorAll('[id]')].filter(vis).map(e => e.id).slice(0, 40)
      };
    }, v, process.env.CLIENT === undefined ? 'Вита' : process.env.CLIENT);
    console.log(JSON.stringify(out, null, 1));
  }
  await b.close();
})();
