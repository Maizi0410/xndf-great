import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackgroundMusic, prepareMusicLoop } from "../src/game/background-music";

class Param {
  value = 1;
  events: [string, number, number][] = [];
  cancelScheduledValues(time: number) { this.events.push(["cancel", this.value, time]); }
  cancelAndHoldAtTime(time: number) { this.events.push(["hold", this.value, time]); }
  setValueAtTime(value: number, time: number) { this.value = value; this.events.push(["set", value, time]); }
  linearRampToValueAtTime(value: number, time: number) { this.value = value; this.events.push(["ramp", value, time]); }
}
class Gain { gain = new Param(); connect() {} }
class Source {
  buffer: AudioBuffer | null = null; loop = false; loopStart = 0; loopEnd = 0;
  onended: (() => void) | null = null; active = false; stoppedAt: number | null = null;
  offset = 0;
  connect() {} disconnect() {}
  start(_time: number, offset: number) { this.offset = offset; this.active = true; }
  stop(time?: number) { this.stoppedAt = time ?? 0; if (time === undefined) { this.active = false; this.onended?.(); } }
}
function buffer() {
  const channels = [new Float32Array(1000), new Float32Array(1000)];
  for (const [c, samples] of channels.entries()) for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i * .07 + c) * .5;
  return { sampleRate: 100, length: 1000, duration: 10, numberOfChannels: 2, getChannelData: (i: number) => channels[i] } as AudioBuffer;
}
class Context {
  currentTime = 0; destination = {}; sources: Source[] = []; gains: Gain[] = [];
  createGain() { const g = new Gain(); this.gains.push(g); return g; }
  createBufferSource() { const s = new Source(); this.sources.push(s); return s; }
  async decodeAudioData() { return buffer(); }
  advance(time: number) {
    this.currentTime += time;
    for (const s of this.sources) if (s.active && s.stoppedAt !== null && s.stoppedAt <= this.currentTime) { s.active = false; s.onended?.(); }
  }
}
let context: Context;
let music: BackgroundMusic;
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  context = new Context();
  vi.stubGlobal("document", { baseURI: "https://example.test/xndf-great/" });
  fetcher = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
  vi.stubGlobal("fetch", fetcher);
  music = new BackgroundMusic(context as unknown as AudioContext, .35, false);
});
afterEach(() => vi.unstubAllGlobals());

describe("single exploration music lifecycle", () => {
  it("does not fetch or create a source before a user start; uses deployment subpath", async () => {
    expect(fetcher).not.toHaveBeenCalled(); expect(context.sources).toHaveLength(0);
    await music.play();
    expect(String(fetcher.mock.calls[0][0])).toBe("https://example.test/xndf-great/audio/bgm_exploration.mp3");
    expect(music.snapshot().state).toBe("playing");
    expect(context.gains[0].gain.value).toBe(.35);
  });
  it("uses the original intro then one sample-clock looping source with a two-second fade", async () => {
    await music.play();
    const source = context.sources[0];
    expect(source.offset).toBe(0); expect(source.loop).toBe(true);
    expect(source.loopStart).toBe(.75); expect(source.loopEnd).toBe(10);
    expect(context.gains[1].gain.events).toContainEqual(["ramp", 1, 2]);
    context.advance(1); expect(music.snapshot().envelope).toBeCloseTo(.5);
    context.advance(9.2); expect(music.snapshot().position).toBeCloseTo(.95);
    context.advance(20); expect(music.snapshot().loops).toBe(3);
    expect(music.snapshot().activeSources).toBe(1); expect(context.sources).toHaveLength(1);
  });
  it("deduplicates concurrent loading and repeated start calls", async () => {
    await Promise.all([music.play(), music.play(), music.play()]);
    await music.play(); expect(fetcher).toHaveBeenCalledTimes(1); expect(context.sources).toHaveLength(1);
  });
  it("pauses position, resumes from it, and disposes the old source", async () => {
    await music.play(); context.advance(4.2); music.setPaused(true);
    expect(music.snapshot().state).toBe("paused"); expect(music.snapshot().activeSources).toBe(0);
    context.advance(30); expect(music.snapshot().position).toBeCloseTo(4.2);
    music.setPaused(false); expect(context.sources[1].offset).toBeCloseTo(4.2);
    expect(context.sources.filter(s => s.active)).toHaveLength(1);
    context.advance(1); expect(music.snapshot().position).toBeCloseTo(5.2);
  });
  it("never starts a pending download while paused", async () => {
    music.setPaused(true); await music.play(); expect(context.sources).toHaveLength(0);
    music.setPaused(false); expect(context.sources).toHaveLength(1);
  });
  it("smooths music volume/mute without resetting playback or creating a source", async () => {
    await music.play(); context.advance(3); music.setVolume(.6); music.setMuted(true); music.setMuted(false);
    expect(music.snapshot().position).toBe(3); expect(context.sources).toHaveLength(1);
    expect(context.gains[0].gain.events).toContainEqual(["ramp", .6, 3.12]);
    expect(context.gains[0].gain.events).toContainEqual(["ramp", 0, 3.12]);
  });
  it("fades out for three seconds and never restarts at completion or unmute", async () => {
    await music.play(); context.advance(4); music.finish(); music.finish();
    expect(music.snapshot().state).toBe("ending");
    context.advance(1.5); expect(music.snapshot().envelope).toBeCloseTo(.5);
    context.advance(1.5); expect(music.snapshot().state).toBe("ended");
    music.setMuted(false); await music.play(); expect(context.sources).toHaveLength(1);
    expect(music.snapshot().activeSources).toBe(0);
  });
  it("preserves the remaining completion fade across a real pause", async () => {
    await music.play(); context.advance(4); music.finish(); context.advance(1); music.setPaused(true);
    context.advance(20); music.setPaused(false); expect(music.snapshot().state).toBe("ending");
    context.advance(1); expect(music.snapshot().envelope).toBeCloseTo(1/3);
    context.advance(1); expect(music.snapshot().state).toBe("ended");
  });
  it("restarts a new game from the intro, including during an old fade", async () => {
    await music.play(); context.advance(5); music.finish(); await music.play(true);
    expect(music.snapshot().position).toBe(0); expect(music.snapshot().state).toBe("playing");
    context.advance(4); expect(music.snapshot().state).toBe("playing");
    expect(context.sources.filter(s => s.active)).toHaveLength(1);
  });
  it("does not let stale loads resurrect a finished game", async () => {
    let resolve!: (r: unknown) => void;
    fetcher.mockImplementationOnce(() => new Promise(r => {resolve = r;}));
    const playing = music.play(); music.finish();
    resolve({ok:true, arrayBuffer:async()=>new ArrayBuffer(8)}); await playing;
    expect(music.snapshot().state).toBe("ended"); expect(context.sources).toHaveLength(0);
  });
  it("reports fetch/decode failure and allows a new-game retry", async () => {
    fetcher.mockResolvedValueOnce({ok:false, status:404});
    await expect(music.play()).rejects.toThrow("404"); expect(music.snapshot().state).toBe("error");
    await music.play(true); expect(music.snapshot().state).toBe("playing");
  });
  it("clamps invalid volume values", () => {
    music.setVolume(2); expect(music.volume).toBe(1);
    music.setVolume(-1); expect(music.volume).toBe(0);
    music.setVolume(NaN); expect(music.volume).toBe(.35);
  });
});

describe("loop seam processing", () => {
  it("preserves the intro and middle, blends both channels, bounds gain and joins to the head sample", () => {
    const b = buffer(); const original = [b.getChannelData(0).slice(), b.getChannelData(1).slice()];
    expect(prepareMusicLoop(b)).toBe(.75);
    for (let c=0;c<2;c++) {
      const samples=b.getChannelData(c);
      expect(samples.slice(0,925)).toEqual(original[c].slice(0,925));
      expect(samples[925]).toBe(original[c][925]); expect(samples[999]).toBe(original[c][74]);
      expect(Math.abs(samples[999]-samples[75])).toBeCloseTo(Math.abs(original[c][74]-original[c][75]));
      for (const value of samples) expect(Math.abs(value)).toBeLessThanOrEqual(.500001);
    }
  });
  it("rejects empty or undersized audio", () => {
    expect(() => prepareMusicLoop({sampleRate:100,length:1,numberOfChannels:2} as AudioBuffer)).toThrow();
  });
});
