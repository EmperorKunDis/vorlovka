import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const root=process.env.QA_URL||'http://127.0.0.1:4321/vorlovka/';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
await fs.mkdir('qa-results',{recursive:true});
const results=[];
try {
 for(const [width,height] of [[320,700],[375,812],[390,844],[430,932],[768,1024],[820,1180],[1024,768],[1280,800],[1440,900]]){
  const context=await browser.newContext({viewport:{width,height}});const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(root,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('.piece:visible').count(),12);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);
  assert.equal(await page.locator('.global-garden').evaluate(el=>el.parentElement===document.body&&getComputedStyle(el).position==='fixed'),true);
  const start=await page.locator('.global-bloom-0').evaluate(el=>getComputedStyle(el).transform);
  for(let y=0;y<await page.evaluate(()=>document.body.scrollHeight);y+=height*.8){await page.evaluate(y=>window.scrollTo(0,y),y);await page.waitForTimeout(80);}
  await page.waitForTimeout(1300);
  const end=await page.locator('.global-bloom-0').evaluate(el=>getComputedStyle(el).transform);
  assert.notEqual(start,end,`global scene did not move ${width}`);
  assert.equal(await page.evaluate(()=>[...document.images].filter(i=>i.currentSrc&&i.complete&&!i.naturalWidth).length),0);
  await page.screenshot({path:`qa-results/${width}-full.png`,fullPage:true});
  for(const [name,count] of [['Domov a sezóny',12],['Postavičky',12],['Oblečení a tašky',8],['Šperky a drobnosti',1]]){
   await page.getByRole('button',{name,exact:true}).click();assert.equal(await page.locator('.piece:visible').count(),count);
  }
  const opener=page.locator('.photo-button:visible').first();await opener.click();await page.locator('dialog[open]').waitFor();
  await page.keyboard.press('Tab');assert.equal(await page.locator('dialog').evaluate(d=>d.contains(document.activeElement)),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await opener.evaluate(e=>e===document.activeElement),true);
  await page.getByRole('button',{name:'Všechno',exact:true}).click();await page.getByRole('button',{name:'Další malé radosti'}).click();assert.equal(await page.locator('.piece:visible').count(),24);
  await page.getByRole('button',{name:'Další malé radosti'}).click();await page.getByRole('button',{name:'Další malé radosti'}).click();assert.equal(await page.locator('.piece:visible').count(),48);
  await page.getByRole('link',{name:'Napište mi',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#kontakt').getBoundingClientRect().top<innerHeight);
  assert.ok((await page.locator('a[href^="https://www.instagram.com/"]:not(#original-post)').evaluateAll(a=>a.map(x=>x.href))).every(h=>h==='https://www.instagram.com/vorlovka/'));
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.ScrollTrigger.getAll().length),0);assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`qa-results/${width}-reduced.png`,fullPage:true});
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  await fs.writeFile(`qa-results/${width}-axe.json`,JSON.stringify(axe,null,2));assert.deepEqual(axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length})),[],`axe ${width}`);assert.deepEqual(errors,[]);
  results.push({width,height,overflow:false,brokenImages:0,globalParallax:true,filters:true,loadMore:true,dialog:true,escape:true,focusReturn:true,reducedMotion:true,axeViolations:0,errors});await context.close();
 }
 await fs.writeFile('qa-results/summary.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
} finally {await browser.close()}
