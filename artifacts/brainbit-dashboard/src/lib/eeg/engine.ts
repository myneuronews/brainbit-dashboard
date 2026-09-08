import { bandPowers, mentalState, powerSpectrum, signalQuality } from './dsp';
import {
  BANDS,
  CHANNELS,
  SAMPLE_RATE,
  type BandName,
  type BandPowers,
  type ChannelName,
  type EegSample,
  type EegSnapshot,
  type MentalState,
} from './types';

const FFT_SIZE = 512; // ~2 s window at 250 Hz -> 0.49 Hz resolution
const WAVEFORM_SAMPLES = SAMPLE_RATE * 4; // 4 s scrolling trace
const BUFFER = 4096;
const MAX_FREQ = 45;
const HISTORY_MAX = 240; // 60 s at 4 Hz
const SMOOTH = 0.15; // EMA factor for mental state

/**
 * Ring-buffers incoming samples and produces analysed snapshots at a fixed rate.
 * Framework-agnostic; the React hook subscribes to `onSnapshot`.
 */
export class EegEngine {
  private buf = CHANNELS.map(() => new Float32Array(BUFFER));
  private times = new Float32Array(BUFFER);
  private head = 0;
  private count = 0;
  private total = 0;
  private history: EegSnapshot['history'] = [];
  private smoothed: MentalState | null = null;
  private listeners = new Set<(s: EegSnapshot) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;

  push = (s: EegSample) => {
    for (let c = 0; c < 4; c++) this.buf[c][this.head] = s.values[c];
    this.times[this.head] = s.t;
    this.head = (this.head + 1) % BUFFER;
    if (this.count < BUFFER) this.count++;
    this.total++;
  };

  reset() {
    this.head = 0;
    this.count = 0;
    this.total = 0;
    this.history = [];
    this.smoothed = null;
  }

  onSnapshot(cb: (s: EegSnapshot) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  startTicking(hz = 10) {
    this.stopTicking();
    this.timer = setInterval(() => this.tick(), 1000 / hz);
  }

  stopTicking() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private latest(c: number, n: number): Float32Array {
    const out = new Float32Array(n);
    const avail = Math.min(n, this.count);
    for (let i = 0; i < avail; i++) {
      const idx = (this.head - avail + i + BUFFER) % BUFFER;
      out[n - avail + i] = this.buf[c][idx];
    }
    return out;
  }

  private latestTimes(n: number): Float32Array {
    const out = new Float32Array(n);
    const avail = Math.min(n, this.count);
    for (let i = 0; i < avail; i++) {
      const idx = (this.head - avail + i + BUFFER) % BUFFER;
      out[n - avail + i] = this.times[idx];
    }
    return out;
  }

  tick() {
    if (this.listeners.size === 0) return;
    const waveform = {} as Record<ChannelName, Float32Array>;
    const perChannel = {} as Record<ChannelName, Float32Array>;
    const bands = {} as Record<ChannelName, BandPowers>;
    const quality = {} as Record<ChannelName, number>;
    let frequencies = new Float32Array(0);
    let mean: Float32Array | null = null;

    CHANNELS.forEach((name, c) => {
      waveform[name] = this.latest(c, WAVEFORM_SAMPLES);
      const window = this.latest(c, FFT_SIZE);
      const { frequencies: f, psd } = powerSpectrum(window, SAMPLE_RATE);
      let cut = 0;
      while (cut < f.length && f[cut] <= MAX_FREQ) cut++;
      frequencies = f.slice(0, cut);
      const p = psd.slice(0, cut);
      perChannel[name] = p;
      if (!mean) mean = new Float32Array(cut);
      for (let k = 0; k < cut; k++) mean[k] += p[k] / 4;
      bands[name] = bandPowers(frequencies, p);
      quality[name] = this.count >= FFT_SIZE ? signalQuality(window) : 0;
    });

    const absolute = {} as Record<BandName, number>;
    const relative = {} as Record<BandName, number>;
    for (const b of BANDS) {
      absolute[b] = CHANNELS.reduce((a, ch) => a + bands[ch].absolute[b], 0) / 4;
      relative[b] = CHANNELS.reduce((a, ch) => a + bands[ch].relative[b], 0) / 4;
    }
    const bandsMean = { absolute, relative };

    const raw = mentalState(bandsMean);
    if (!this.smoothed || this.count < FFT_SIZE) {
      this.smoothed = raw;
    } else {
      this.smoothed = {
        concentration: this.smoothed.concentration + SMOOTH * (raw.concentration - this.smoothed.concentration),
        relaxation: this.smoothed.relaxation + SMOOTH * (raw.relaxation - this.smoothed.relaxation),
        drowsiness: this.smoothed.drowsiness + SMOOTH * (raw.drowsiness - this.smoothed.drowsiness),
      };
    }
    const mental: MentalState = {
      concentration: Math.round(this.smoothed.concentration),
      relaxation: Math.round(this.smoothed.relaxation),
      drowsiness: Math.round(this.smoothed.drowsiness),
    };

    const now = Date.now();
    const last = this.history[this.history.length - 1];
    if (!last || now - last.t >= 250) {
      this.history.push({ t: now, ...mental });
      if (this.history.length > HISTORY_MAX) this.history.shift();
    }

    const snapshot: EegSnapshot = {
      waveform,
      waveformTimes: this.latestTimes(WAVEFORM_SAMPLES),
      spectrum: { frequencies, perChannel, mean: mean ?? new Float32Array(0) },
      bands,
      bandsMean,
      mental,
      history: this.history.slice(),
      quality,
      samplesReceived: this.total,
      sampleRate: SAMPLE_RATE,
    };
    this.listeners.forEach((cb) => cb(snapshot));
  }
}
