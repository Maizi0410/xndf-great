/** One decoded, sample-clock loop. The immutable WAV master is never served. */
export const MUSIC_URL = "audio/bgm_exploration.mp3";
export const LOOP_CROSSFADE_SECONDS = 0.75;

// Blend only the playback buffer's tail with its head. Play the original intro
// once, then wrap to the end of the blended head. No timers or second track.
export function prepareMusicLoop(buffer: AudioBuffer) {
  const frames = Math.min(Math.round(buffer.sampleRate * LOOP_CROSSFADE_SECONDS), Math.floor(buffer.length / 4));
  if (frames < 2) throw new Error("Music buffer is too short");
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let i = 0; i < frames; i++) {
      const mix = (1 - Math.cos(Math.PI * i / (frames - 1))) / 2;
      const at = buffer.length - frames + i;
      samples[at] = samples[at] * (1 - mix) + samples[i] * mix;
    }
  }
  return frames / buffer.sampleRate;
}

function smooth(param: AudioParam, now: number, value: number, seconds: number) {
  if (typeof param.cancelAndHoldAtTime === "function") param.cancelAndHoldAtTime(now);
  else { const held = param.value; param.cancelScheduledValues(now); param.setValueAtTime(held, now); }
  param.linearRampToValueAtTime(value, now + seconds);
}

export class BackgroundMusic {
  private buffer: AudioBuffer | null = null;
  private loading: Promise<void> | null = null;
  private source: AudioBufferSourceNode | null = null;
  private output: GainNode;
  private envelope: GainNode;
  private requested = false;
  private completed = false;
  private error = false;
  private generation = 0;
  private paused = false;
  private offset = 0;
  private sourceOffset = 0;
  private sourceTime = 0;
  private firstPlay = true;
  private ending = false;
  private endRemaining = 0;
  private endAt = 0;
  private envelopeFrom = 0;
  private envelopeTo = 0;
  private envelopeStart = 0;
  private envelopeEnd = 0;
  private heldEnvelope = 1;
  private loopStart = 0;
  private starts = 0;
  volume: number;
  muted: boolean;

  constructor(private context: AudioContext, volume: number, muted: boolean) {
    this.volume = volume; this.muted = muted;
    this.output = context.createGain(); this.envelope = context.createGain();
    this.output.gain.value = muted ? 0 : volume;
    this.envelope.gain.value = 0;
    this.envelope.connect(this.output); this.output.connect(context.destination);
  }
  private async load() {
    if (this.buffer) return;
    if (!this.loading) {
      this.loading = (async () => {
        const response = await fetch(new URL(MUSIC_URL, document.baseURI));
        if (!response.ok) throw new Error(`Music HTTP ${response.status}`);
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        this.loopStart = prepareMusicLoop(buffer);
        this.buffer = buffer;
      })().finally(() => { this.loading = null; });
    }
    await this.loading;
  }
  async play(restart = false) {
    if (this.completed && !restart) return;
    if (restart) {
      this.generation++; this.detach(); this.offset = 0;
      this.completed = false; this.ending = false; this.firstPlay = true;
    }
    this.requested = true; this.error = false;
    const generation = this.generation;
    try {
      await this.load();
      if (generation === this.generation && this.requested && !this.paused && !this.source) this.startSource();
    } catch (error) {
      if (generation === this.generation) this.error = true;
      throw error;
    }
  }
  private envelopeValue() {
    const t = this.envelopeEnd <= this.envelopeStart ? 1 : Math.max(0, Math.min(1, (this.context.currentTime - this.envelopeStart) / (this.envelopeEnd - this.envelopeStart)));
    return this.envelopeFrom + (this.envelopeTo - this.envelopeFrom) * t;
  }
  private fade(to: number, seconds: number, from = this.envelopeValue()) {
    const now = this.context.currentTime;
    this.envelopeFrom = from; this.envelopeTo = to;
    this.envelopeStart = now; this.envelopeEnd = now + seconds;
    this.envelope.gain.cancelScheduledValues(now);
    this.envelope.gain.setValueAtTime(from, now);
    this.envelope.gain.linearRampToValueAtTime(to, now + seconds);
  }
  private startSource() {
    if (!this.buffer || this.source || !this.requested || this.completed) return;
    const source = this.context.createBufferSource();
    source.buffer = this.buffer; source.loop = true;
    source.loopStart = this.loopStart; source.loopEnd = this.buffer.duration;
    source.connect(this.envelope);
    this.source = source; this.sourceOffset = this.offset; this.sourceTime = this.context.currentTime;
    source.onended = () => {
      if (this.source !== source) return;
      source.disconnect(); this.source = null;
      if (this.ending) { this.completed = true; this.requested = false; }
    };
    source.start(0, this.offset); this.starts++;
    if (this.ending) {
      this.fade(0, this.endRemaining, this.heldEnvelope);
      this.endAt = this.context.currentTime + this.endRemaining;
      source.stop(this.endAt);
    } else this.fade(1, this.firstPlay ? 2 : 0.12, 0);
    this.firstPlay = false;
  }
  private position() {
    if (!this.source || !this.buffer) return this.offset;
    const raw = this.sourceOffset + Math.max(0, this.context.currentTime - this.sourceTime);
    return raw < this.buffer.duration ? raw : this.loopStart + (raw - this.buffer.duration) % (this.buffer.duration - this.loopStart);
  }
  private detach() {
    if (!this.source) return;
    const source = this.source; this.source = null;
    source.onended = null; source.stop(); source.disconnect();
  }
  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.offset = this.position(); this.heldEnvelope = this.envelopeValue();
      if (this.ending) this.endRemaining = Math.max(0, this.endAt - this.context.currentTime);
      this.detach();
    } else if (this.requested && this.buffer && !this.completed) {
      if (this.ending && this.endRemaining <= 0) { this.completed = true; this.requested = false; }
      else this.startSource();
    }
  }
  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.35));
    smooth(this.output.gain, this.context.currentTime, this.muted ? 0 : this.volume, 0.12);
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    smooth(this.output.gain, this.context.currentTime, muted ? 0 : this.volume, 0.12);
  }
  finish() {
    if (this.completed || this.ending) return;
    this.ending = true; this.endRemaining = 3;
    if (this.source) {
      this.fade(0, 3); this.endAt = this.context.currentTime + 3;
      this.source.stop(this.endAt);
    } else { this.generation++; this.completed = true; this.requested = false; }
  }
  snapshot() {
    const elapsed = this.source ? this.sourceOffset + Math.max(0, this.context.currentTime - this.sourceTime) : this.offset;
    return {
      state: this.completed ? "ended" : this.error ? "error" : !this.requested ? "idle" : this.paused ? "paused" : this.loading ? "loading" : this.ending ? "ending" : this.source ? "playing" : "idle",
      position: this.position(), duration: this.buffer?.duration ?? 0, loopStart: this.loopStart,
      loops: this.buffer && this.source && elapsed >= this.buffer.duration ? 1 + Math.floor((elapsed - this.buffer.duration) / (this.buffer.duration - this.loopStart)) : 0,
      activeSources: this.source ? 1 : 0, starts: this.starts,
      volume: this.volume, muted: this.muted, envelope: this.envelopeValue(),
      outputGain: this.output.gain.value,
    };
  }
}
