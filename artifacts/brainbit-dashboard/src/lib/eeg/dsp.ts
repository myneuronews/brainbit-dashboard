import {
  BAND_RANGES,
  BANDS,
  type BandName,
  type BandPowers,
  type MentalState,
} from './types';

/** In-place iterative radix-2 FFT. re/im length must be a power of two. */
export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  // bit reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const ar = re[i + k + half];
        const ai = im[i + k + half];
        const tr = ar * cr - ai * ci;
        const ti = ar * ci + ai * cr;
        re[i + k + half] = re[i + k] - tr;
        im[i + k + half] = im[i + k] - ti;
        re[i + k] += tr;
        im[i + k] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

const hannCache = new Map<number, Float32Array>();
function hann(n: number): Float32Array {
  let w = hannCache.get(n);
  if (!w) {
    w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    hannCache.set(n, w);
  }
  return w;
}

/**
 * One-sided power spectral density of `signal` (µV) using a Hann window.
 * Returns bins 0..fs/2 as µV²/Hz.
 */
export function powerSpectrum(signal: Float32Array, sampleRate: number): {
  frequencies: Float32Array;
  psd: Float32Array;
} {
  const n = signal.length;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  const w = hann(n);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += signal[i];
  mean /= n;
  let wsum = 0;
  for (let i = 0; i < n; i++) {
    re[i] = (signal[i] - mean) * w[i];
    wsum += w[i] * w[i];
  }
  fft(re, im);
  const half = n / 2;
  const psd = new Float32Array(half);
  const frequencies = new Float32Array(half);
  const scale = 1 / (sampleRate * wsum);
  for (let k = 0; k < half; k++) {
    let p = (re[k] * re[k] + im[k] * im[k]) * scale;
    if (k > 0 && k < half - 1) p *= 2;
    psd[k] = p;
    frequencies[k] = (k * sampleRate) / n;
  }
  return { frequencies, psd };
}

/** Integrate PSD over each band range. */
export function bandPowers(frequencies: Float32Array, psd: Float32Array): BandPowers {
  const df = frequencies.length > 1 ? frequencies[1] - frequencies[0] : 1;
  const absolute = {} as Record<BandName, number>;
  let total = 0;
  for (const b of BANDS) {
    const [lo, hi] = BAND_RANGES[b];
    let sum = 0;
    for (let k = 0; k < frequencies.length; k++) {
      const f = frequencies[k];
      if (f >= lo && f < hi) sum += psd[k] * df;
    }
    absolute[b] = sum;
    total += sum;
  }
  const relative = {} as Record<BandName, number>;
  for (const b of BANDS) relative[b] = total > 0 ? absolute[b] / total : 0;
  return { absolute, relative };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Heuristic mental-state indices from relative band powers.
 * These are classic neurofeedback ratios, mapped to 0..100.
 */
export function mentalState(b: BandPowers): MentalState {
  const { alpha, beta, theta, delta } = b.relative;
  const eps = 1e-9;
  // Beta relative to slow rhythms — engagement index (Pope et al.).
  const engagement = beta / (alpha + theta + eps);
  // Alpha dominance over beta — relaxed wakefulness.
  const calm = alpha / (alpha + beta + eps);
  // Theta+delta share — drowsiness / mind wandering.
  const slow = (theta + delta) / (alpha + beta + theta + delta + eps);
  return {
    concentration: Math.round(100 * clamp01(engagement / 1.6)),
    relaxation: Math.round(100 * clamp01(calm)),
    drowsiness: Math.round(100 * clamp01((slow - 0.3) / 0.5)),
  };
}

/** Simple RMS-based signal quality: clean EEG at rest sits well under ~60 µV RMS. */
export function signalQuality(signal: Float32Array): number {
  let mean = 0;
  for (let i = 0; i < signal.length; i++) mean += signal[i];
  mean /= signal.length || 1;
  let acc = 0;
  for (let i = 0; i < signal.length; i++) {
    const d = signal[i] - mean;
    acc += d * d;
  }
  const rms = Math.sqrt(acc / (signal.length || 1));
  if (rms < 1e-3) return 0; // flat line = no contact
  return clamp01(1 - (rms - 30) / 150);
}
