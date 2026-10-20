import { BackgroundMusic } from "./background-music";

export class Soundscape {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  enabled = true;
  volume = 0.35;
  music: BackgroundMusic | null = null;
  private paused = document.hidden;
  constructor() {
    try {
      const value = JSON.parse(localStorage.getItem("permitted-audio") ?? "null");
      if (value && typeof value.volume === "number" && Number.isFinite(value.volume)) this.volume = Math.max(0, Math.min(1, value.volume));
      if (value && typeof value.muted === "boolean") this.enabled = !value.muted;
    } catch { /* Restricted storage must not prevent play. */ }
  }
  private save() {
    try { localStorage.setItem("permitted-audio", JSON.stringify({volume:this.volume, muted:!this.enabled})); } catch {}
  }
  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(value) ? value : .35));
    this.music?.setVolume(this.volume); this.save();
  }
  setPaused(paused: boolean) {
    this.paused = paused; this.music?.setPaused(paused);
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.enabled && !paused ? .15 : 0, this.context.currentTime, .04);
    if (!paused) void this.context?.resume().catch(() => {});
  }
  lastFootstep = 0;
  lastRotation = 0;
  async start(restart = false) {
    if (this.context) {
      const unlocked = this.context.resume();
      const playing = this.music!.play(restart);
      await Promise.all([unlocked, playing]);
      return;
    }
    const c = (this.context = new AudioContext());
    this.master = c.createGain();
    this.master.gain.value = this.enabled && !this.paused ? 0.15 : 0;
    this.master.connect(c.destination);
    const b = c.createBuffer(1, c.sampleRate * 4, c.sampleRate),
      d = b.getChannelData(0);
    let v = 0;
    for (let i = 0; i < d.length; i++) {
      v = (v + (0.5 - Math.random()) * 0.035) * 0.99;
      d[i] = v;
    }
    const n = c.createBufferSource();
    n.buffer = b;
    n.loop = true;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 420;
    const g = c.createGain();
    g.gain.value = 0.32;
    n.connect(f);
    f.connect(g);
    g.connect(this.master);
    // A second, slowly modulated band gives the water its own soft movement.
    const water = c.createBiquadFilter();
    water.type = "bandpass";
    water.frequency.value = 1100;
    water.Q.value = 0.6;
    const waterGain = c.createGain();
    waterGain.gain.value = 0.12;
    const tide = c.createOscillator();
    tide.frequency.value = 0.17;
    const modulation = c.createGain();
    modulation.gain.value = 0.06;
    tide.connect(modulation);
    modulation.connect(waterGain.gain);
    n.connect(water);
    water.connect(waterGain);
    waterGain.connect(this.master);
    tide.start();
    n.start();
    this.music = new BackgroundMusic(c, this.volume, !this.enabled);
    this.music.setPaused(this.paused);
    const unlocked = c.resume();
    await Promise.all([unlocked, this.music.play(restart)]);
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        this.enabled && !this.paused ? 0.15 : 0,
        this.context.currentTime,
        0.2,
      );
    this.music?.setMuted(!this.enabled); this.save();
    if (this.enabled) void this.context?.resume().catch(() => {});
    return this.enabled;
  }
  tone(
    freq: number,
    duration: number,
    volume = 0.3,
    type: OscillatorType = "sine",
  ) {
    if (!this.context || !this.master || this.paused) return;
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      freq * 0.7,
      c.currentTime + duration,
    );
    g.gain.setValueAtTime(0.001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(volume, c.currentTime + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(c.currentTime + duration);
  }
  freeze() {
    this.tone(680, 1.8, 0.2, "triangle");
    setTimeout(() => this.tone(1020, 1.2, 0.08), 180);
  }
  rotate(now: number, proximity: number) {
    if(now-this.lastRotation<.24) return;
    this.lastRotation=now;
    this.tone(54+proximity*90,.28,.035,"triangle");
    if(proximity>.7) this.tone(350+proximity*180,.3,.025);
  }
  melt() { this.tone(92,1.4,.1,"triangle"); this.tone(170,.45,.04,"sawtooth"); }
  step(now: number, material: "stone" | "ice" = "stone") {
    if (now - this.lastFootstep > 0.64) {
      this.lastFootstep = now;
      this.tone((material === "ice" ? 260 : 100) + Math.random() * 40, 0.12, 0.1, "triangle");
    }
  }
  finish() {
    // No additional ending score: let the one exploration track fade out.
    this.music?.finish();
  }
}
