// Презентация → PDF и превью слайдов: node pdf.js
const puppeteer = require('../tutorials/node_modules/puppeteer-core');
const path = require('path'), fs = require('fs');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const p = await b.newPage();
  await p.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve('deck.html'), { waitUntil: 'networkidle0', timeout: 120000 });
  await p.evaluate(() => document.fonts.ready);
  fs.mkdirSync('preview', { recursive: true });
  const n = await p.$$eval('.slide', s => s.length);
  for (let i = 0; i < n; i++) {
    const el = (await p.$$('.slide'))[i];
    await el.screenshot({ path: `preview/${String(i + 1).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 70 });
  }
  await p.pdf({ path: 'Maker — презентация.pdf', width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
  console.log('слайдов', n);
  await b.close();
})();
