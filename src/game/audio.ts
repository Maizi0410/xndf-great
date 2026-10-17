export class Soundscape {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  enabled = true;
  lastFootstep = 0;
  async start() {
    if (this.context) {
      await this.context.resume();
      return;
    }
    const c = (this.context = new AudioContext());
    this.master = c.createGain();
    this.master.gain.value = this.enabled ? 0.15 : 0;
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
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        this.enabled ? 0.15 : 0,
        this.context.currentTime,
        0.2,
      );
    return this.enabled;
  }
  tone(
    freq: number,
    duration: number,
    volume = 0.3,
    type: OscillatorType = "sine",
  ) {
    if (!this.context || !this.master) return;
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
  step(now: number) {
    if (now - this.lastFootstep > 0.64) {
      this.lastFootstep = now;
      this.tone(100 + Math.random() * 40, 0.12, 0.13, "triangle");
    }
  }
  finish() {
    [220, 330, 440, 660].forEach((f, i) =>
      setTimeout(() => this.tone(f, 3, 0.16), i * 240),
    );
  }
}
