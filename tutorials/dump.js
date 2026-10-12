// Подсказка для сценариев: что видно на экране — node dump.js <view> [client]
const puppeteer=require('puppeteer-core');
(async()=>{const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new'});const p=await b.newPage();await p.setViewport({width:1600,height:900});
await p.evaluateOnNewDocument(()=>{localStorage.clear();localStorage.setItem('mk-intro','1');localStorage.setItem('mk-tips','1');localStorage.setItem('mk-auth','in');localStorage.setItem('mk-state','active');});
await p.goto('http://localhost:8934/prototype.html#/home',{waitUntil:'networkidle0'});await new Promise(r=>setTimeout(r,1500));
const out=await p.evaluate((v,c)=>{try{tipsEnd()}catch(e){};if(c)clientSet(c,false,true);go(v);const V=document.querySelector('.view.on');const q=s=>[...V.querySelectorAll(s)].filter(e=>e.offsetParent).slice(0,14).map(e=>(e.id?'#'+e.id+' ':'')+e.className+' :: '+e.textContent.trim().replace(/\s+/g,' ').slice(0,60));return {id:V.id,phead:q('.phead button,.phead .pbtn'),h3:q('h3'),stepH:q('.step-h'),ids:[...V.querySelectorAll('[id]')].filter(e=>e.offsetParent).map(e=>e.id).slice(0,40),tabs:q('.itab,.chip')};},process.argv[2],process.argv[3]||'');
console.log(JSON.stringify(out,null,1));await b.close();})();
