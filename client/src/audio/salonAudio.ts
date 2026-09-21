// Procedural WebAudio salon ambience — no external files, no copyrighted music.
// Fan hum + tanpura-ish drone + pentatonic "retro filmi" pluck loop + clipper/scissor SFX.

class SalonAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private fanNodes: { osc: OscillatorNode; gain: GainNode } | null = null;
  musicOn = true;
  sfxOn = true;
  private step = 0;

  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.35;
        this.musicGain.connect(this.master);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.8;
        this.sfxGain.connect(this.master);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  start() {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this.startFan();
    this.startMusic();
  }

  setMusicOn(on: boolean) {
    this.musicOn = on;
    if (this.musicGain && this.ctx)
      this.musicGain.gain.setTargetAtTime(on ? 0.35 : 0.0, this.ctx.currentTime, 0.1);
  }

  setSfxOn(on: boolean) {
    this.sfxOn = on;
    if (this.sfxGain && this.ctx)
      this.sfxGain.gain.setTargetAtTime(on ? 0.8 : 0.0, this.ctx.currentTime, 0.1);
  }

  private startFan() {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.fanNodes) return;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 58;
    const gain = ctx.createGain();
    gain.gain.value = 0.012;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.005;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    lfo.start();
    this.fanNodes = { osc, gain };
  }

  private startMusic() {
    if (this.musicTimer !== null) return;
    this.beginLoop();
  }

  /** Club Bollywood mode: double tempo + bass thump. Called when entering/leaving the club. */
  setParty(on: boolean) {
    if (this.party === on) return;
    this.party = on;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.beginLoop();
  }

  private party = false;

  private beginLoop() {
    // Khamaj-ish pentatonic: Sa Re Ga Pa Dha (C D E G A)
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];
    const melody = [0, 2, 4, 4, 3, 2, 1, 0, 2, 4, 5, 4, 2, 1, 0, 0];
    const stepDur = this.party ? 235 : 420;
    const tick = () => {
      if (this.musicOn) {
        this.pluck(scale[melody[this.step % melody.length]]);
        if (this.party && this.step % 2 === 0) this.pluck(scale[melody[this.step % melody.length]] / 2);
      }
      if (this.party && this.musicOn) this.bass();
      // drone on Sa every 8 steps (radio mode only)
      if (!this.party && this.step % 8 === 0 && this.musicOn) this.drone();
      this.step++;
    };
    tick();
    this.musicTimer = window.setInterval(tick, stepDur);
  }

  private bass() {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  private pluck(freq: number) {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.55);
  }

  private drone() {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const t = ctx.currentTime;
    for (const f of [130.81, 196.0]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 2.6);
    }
  }

  clipper(durationMs = 900) {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * (durationMs / 1000));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.25;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 3200;
    bp.Q.value = 2;
    // buzz amplitude modulation ~90Hz for clipper feel
    const am = ctx.createOscillator();
    am.frequency.value = 90;
    const amG = ctx.createGain();
    amG.gain.value = 0.5;
    am.connect(amG);
    const g = ctx.createGain();
    g.gain.value = 0.6;
    amG.connect(g.gain);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    am.start(t);
    src.stop(t + durationMs / 1000);
    am.stop(t + durationMs / 1000);
  }

  snip() {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(4500, t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  bell() {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    for (const f of [880, 1320]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.85);
    }
  }

  step_() {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.11);
  }
}

export const salonAudio = new SalonAudio();
