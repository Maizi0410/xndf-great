import { test, expect, Page } from "@playwright/test";
import { createHash } from "node:crypto";
const status = async (page: Page) => JSON.parse((await page.locator("#app").getAttribute("data-music")) ?? "{}");

test("real MP3 starts once after click, renders a continuous seam, loops naturally and resumes position", async ({page}) => {
  const fetched: string[] = [];
  page.on("request", r => {if (/audio\//.test(r.url())) fetched.push(r.url());});
  // Observe native audio nodes only in this test, without mutating game/music state.
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    (window as any).__musicSources = [];
    window.AudioContext = class extends Native {
      createBufferSource() {
        const source = super.createBufferSource();
        (window as any).__musicSources.push(source);
        return source;
      }
    };
  });
  await page.goto("./");
  await expect.poll(async()=> (await status(page)).state).toBe("idle");
  expect(fetched).toEqual([]);
  await page.locator("#begin").click();
  await expect.poll(async()=> (await status(page)).state,{timeout:20000}).toBe("playing");
  await expect.poll(async()=> (await status(page)).envelope).toBeCloseTo(1,1);
  let s=await status(page);
  expect(s.duration).toBeCloseTo(120.78,1); expect(s.activeSources).toBe(1); expect(s.starts).toBe(1);
  expect(s.volume).toBe(.35);
  // Render the actual decoded/processed stereo loop across its boundary using
  // OfflineAudioContext, rather than assuming source.loop proves a clean seam.
  const seam = await page.evaluate(async()=>{
    const source=(window as any).__musicSources.find((s: AudioBufferSourceNode)=>s.loop && s.buffer && s.buffer.duration>120) as AudioBufferSourceNode;
    if(!source?.buffer) throw new Error("Missing native music buffer");
    const rate=source.buffer.sampleRate, frames=Math.round(rate*.16), before=Math.round(rate*.08);
    const c=new OfflineAudioContext(2,frames,rate), loop=c.createBufferSource();
    loop.buffer=source.buffer;loop.loop=true;loop.loopStart=source.loopStart;loop.loopEnd=source.loopEnd;
    loop.connect(c.destination);loop.start(0,source.loopEnd-before/rate);
    const b=await c.startRendering();
    return [0,1].map(channel=>{
      const a=b.getChannelData(channel),rms=Math.sqrt(a.reduce((sum,x)=>sum+x*x,0)/a.length);
      let maxDelta=0, zeros=0, run=0;
      for(let i=1;i<a.length;i++){maxDelta=Math.max(maxDelta,Math.abs(a[i]-a[i-1]));run=Math.abs(a[i])<1e-7?run+1:0;zeros=Math.max(zeros,run);}
      const seamDelta=Math.abs(a[before]-a[before-1]);
      return {rms,maxDelta,seamDelta,longestSilence:zeros/rate};
    });
  });
  for(const channel of seam) {
    expect(channel.rms).toBeGreaterThan(.005);
    expect(channel.seamDelta).toBeLessThan(.05);
    expect(channel.longestSilence).toBeLessThan(.002);
  }
  await page.locator("#rotation").fill("-56");
  await expect(page.locator("#confirm")).toBeEnabled({timeout:25000});
  await expect.poll(async()=> (await status(page)).loops,{timeout:135000,intervals:[1000]}).toBeGreaterThanOrEqual(1);
  s=await status(page);expect(s.starts).toBe(1);expect(s.activeSources).toBe(1);
  const prePause=s.position;
  // Simulate the browser visibility notification used by the existing pause.
  await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));});
  await expect.poll(async()=> (await status(page)).state).toBe("paused");
  const paused=await status(page);
  await page.waitForTimeout(1100);
  expect((await status(page)).position).toBeCloseTo(paused.position,2);
  expect(paused.position).toBeGreaterThanOrEqual(prePause);
  await page.evaluate(()=>{delete (document as any).hidden;document.dispatchEvent(new Event("visibilitychange"));});
  await expect.poll(async()=> (await status(page)).state).toBe("playing");
  s=await status(page);expect(s.activeSources).toBe(1);expect(s.starts).toBe(2);
  expect(s.position).toBeGreaterThanOrEqual(paused.position);expect(s.position).toBeLessThan(paused.position+3);
  expect(fetched.filter(url=>url.endsWith(".mp3"))).toHaveLength(1);
  expect(fetched.some(url=>url.endsWith(".wav"))).toBe(false);
  await test.info().attach("actual-loop-seam.json",{body:JSON.stringify({seam,naturalLoop:true,visibility:"simulated browser event; real audio clock/source"},null,2),contentType:"application/json"});
});

test("music volume and mute persist across reload; mute never starts music on title screen",async({page})=>{
  await page.goto("./");
  await page.locator("#music-volume").fill("63"); await page.locator("#sound").click();
  await page.reload();
  await expect(page.locator("#music-volume")).toHaveValue("63");
  await expect(page.locator("#sound")).toHaveAttribute("aria-pressed","true");
  expect((await status(page)).state).toBe("idle");
  await page.locator("#begin").click();
  await expect.poll(async()=>(await status(page)).state,{timeout:20000}).toBe("playing");
  expect((await status(page)).muted).toBe(true);expect((await status(page)).outputGain).toBe(0);
  await page.locator("#sound").click();
  await expect.poll(async()=>(await status(page)).outputGain).toBeCloseTo(.63,2);
  const before=await status(page);
  await page.locator("#music-volume").fill("24");
  await expect.poll(async()=>(await status(page)).outputGain).toBeCloseTo(.24,2);
  expect((await status(page)).starts).toBe(before.starts);
  await page.locator("#restart").click();
  await expect.poll(async()=>(await status(page)).starts).toBe(2);
  expect((await status(page)).position).toBeLessThan(3);
});

test("music loading failure is isolated from puzzle controls and crossing",async({page})=>{
  await page.route("**/audio/bgm_exploration.mp3",route=>route.abort());
  await page.goto("./");await page.locator("#begin").click();
  await expect.poll(async()=>(await status(page)).state,{timeout:15000}).toBe("error");
  await expect(page.locator("#fatal")).toBeHidden();
  await page.locator("#rotation").fill("-56");
  await expect(page.locator("#confirm")).toBeEnabled({timeout:25000});
  await page.locator("#confirm").click();
  await expect(page.locator("#app")).toHaveAttribute("data-platform","L",{timeout:40000});
});

test("compressed music has correct bytes and audio MIME under the repository subpath",async({request})=>{
  const manifest=await request.get("audio/bgm_exploration.json");expect(manifest.ok()).toBe(true);
  const meta=await manifest.json();const mp3=await request.get("audio/bgm_exploration.mp3");
  expect(mp3.ok()).toBe(true);expect(mp3.headers()["content-type"]).toContain("audio/mpeg");
  const body=await mp3.body();expect(body.length).toBe(3866924);
  expect(createHash("sha256").update(body).digest("hex")).toBe(meta.playback_sha256);
  expect(meta.bitrate_kbps).toBe(256);expect(meta.master_bytes).toBe(23189804);
});
