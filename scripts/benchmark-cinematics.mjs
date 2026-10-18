// Optional real-browser probe, not a hardware pass/fail threshold.
// BENCHMARK_DPR=.65 CHROMIUM_PATH=/usr/bin/chromium BENCHMARK_QUALITY=high node scripts/benchmark-cinematics.mjs URL
import { chromium, expect } from '@playwright/test';
const url=process.argv[2];
if(!url || !/^https?:\/\//.test(url)) throw new Error('Provide the actual preview or deployment URL');
const quality=process.env.BENCHMARK_QUALITY??'auto';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:Number(process.env.BENCHMARK_DPR??1)});
 await page.goto(url);await expect(page.locator('#fatal')).toBeHidden();
 if(quality==='high' && await page.locator('#quality').count()) await page.locator('#quality').click();
 await page.locator('#begin').click();
 async function sample(name){
  const result=await page.evaluate(async()=>{
   for(let i=0;i<60;i++) await new Promise(requestAnimationFrame);
   const times=[];let last=performance.now();
   for(let i=0;i<60;i++){await new Promise(requestAnimationFrame);const now=performance.now();times.push(now-last);last=now;}
   const sorted=[...times].sort((a,b)=>a-b);
   return {frames:times.length,medianMs:sorted[30],meanMs:times.reduce((a,b)=>a+b,0)/times.length,p95Ms:sorted[57],render:JSON.parse(document.getElementById('app').dataset.render??'{}'),camera:JSON.parse(document.getElementById('app').dataset.camera??'{}')};
  });console.log(JSON.stringify({scenario:name,quality,dpr:Number(process.env.BENCHMARK_DPR??1),...result}));
 }
 await sample('overview');
 await page.locator('#rotation').fill('-56');await page.locator('#rotation').dispatchEvent('input');
 await expect(page.locator('#confirm')).toBeEnabled({timeout:25000});
 await sample('aligned closeup');
} finally {await browser.close();}
