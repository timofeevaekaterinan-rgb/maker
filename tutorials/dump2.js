const puppeteer=require('puppeteer-core');
(async()=>{const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new'});const p=await b.newPage();await p.setViewport({width:1600,height:900});
await p.evaluateOnNewDocument(()=>{localStorage.clear();localStorage.setItem('mk-intro','1');localStorage.setItem('mk-tips','1');localStorage.setItem('mk-auth','in');localStorage.setItem('mk-state','active');});
await p.goto('http://localhost:8934/prototype.html#/home',{waitUntil:'networkidle0'});await new Promise(r=>setTimeout(r,1500));
for(const v of process.argv.slice(2)){const out=await p.evaluate(v=>{try{tipsEnd()}catch(e){};clientSet('Вита',false,true);go(v);const V=document.querySelector('.view.on');
 const kids=[...V.children].filter(e=>e.offsetParent).map(e=>e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+'.'+[...e.classList].join('.')+' :: '+e.textContent.trim().replace(/\s+/g,' ').slice(0,70));
 const btn=[...V.querySelectorAll('button')].filter(e=>e.offsetParent).slice(0,25).map(e=>[...e.classList].join('.')+' :: '+e.textContent.trim().replace(/\s+/g,' ').slice(0,40));
 const h=[...V.querySelectorAll('h2,h3')].filter(e=>e.offsetParent).slice(0,12).map(e=>e.textContent.trim().slice(0,50));
 return {v,kids,btn,h};},v);console.log(JSON.stringify(out));}
await b.close();})();
