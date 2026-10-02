// node render.js frames <outDir> [fps]   — все кадры ролика
// node render.js keys <outDir> t1,t2,... — отдельные кадры для проверки
const puppeteer=require('puppeteer-core');
const [,,mode,out,arg]=process.argv;
const fs=require('fs');fs.mkdirSync(out,{recursive:true});
(async()=>{
  const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--hide-scrollbars','--force-color-profile=srgb']});
  const p=await b.newPage();
  p.on('pageerror',e=>console.error('PAGE ERROR',e.message));
  await p.setViewport({width:1920,height:1080,deviceScaleFactor:1});
  await p.goto('http://localhost:8934/promo/scene.html?capture',{waitUntil:'networkidle0'});
  console.log('assets',await p.evaluate(()=>ready()));
  const shot=async(t,file)=>{await p.evaluate(t=>render(t),t);await p.screenshot({path:file,type:'jpeg',quality:92});};
  if(mode==='keys'){for(const t of arg.split(',').map(Number))await shot(t,`${out}/k${t.toFixed(2)}.jpg`);}
  else{const fps=+(arg||30),n=20*fps;for(let f=0;f<n;f++){await shot(f/fps,`${out}/f${String(f).padStart(4,'0')}.jpg`);if(f%60===0)console.log('frame',f);}}
  await b.close();
})();
