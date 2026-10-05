// Покадровая запись сцены (нужен сервер maker на :8934 и `npm i puppeteer-core@23`).
// node render.js frames <outDir> [fps] [page] [w] [h] [dur]  — все кадры
// node render.js keys   <outDir> t1,t2,... [page] [w] [h]    — отдельные кадры для проверки
// page по умолчанию scene.html 1920×1080 20 с; Reels: reels.html 1080 1920 15
const puppeteer=require('puppeteer-core');
const [,,mode,out,arg,page='scene.html',W='1920',H='1080',D='20']=process.argv;
const fs=require('fs');fs.mkdirSync(out,{recursive:true});
(async()=>{
  const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--hide-scrollbars','--force-color-profile=srgb']});
  const p=await b.newPage();
  p.on('pageerror',e=>console.error('PAGE ERROR',e.message));
  await p.setViewport({width:+W,height:+H,deviceScaleFactor:1});
  await p.goto(`http://localhost:8934/promo/${page}?capture`,{waitUntil:'networkidle0'});
  console.log('assets',await p.evaluate(()=>ready()));
  const shot=async(t,file)=>{await p.evaluate(t=>render(t),t);await p.screenshot({path:file,type:'jpeg',quality:92});};
  if(mode==='keys'){for(const t of arg.split(',').map(Number))await shot(t,`${out}/k${t.toFixed(2)}.jpg`);}
  else{const fps=+(arg||30),n=Math.round(+D*fps);for(let f=0;f<n;f++){await shot(f/fps,`${out}/f${String(f).padStart(4,'0')}.jpg`);if(f%60===0)console.log('frame',f);}}
  await b.close();
})();
