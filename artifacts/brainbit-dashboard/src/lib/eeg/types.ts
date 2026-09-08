export const SAMPLE_RATE = 250;
export const CHANNELS = ['O1', 'O2', 'T3', 'T4'] as const;
export type ChannelName = (typeof CHANNELS)[number];

export const BANDS = ['delta', 'theta', 'alpha', 'beta', 'gamma'] as const;
export type BandName = (typeof BANDS)[number];

/** Frequency ranges in Hz. */
export const BAND_RANGES: Record<BandName, [number, number]> = {
  delta: [1, 4],
  theta: [4, 8],
  alpha: [8, 13],
  beta: [13, 30],
  gamma: [30, 45],
};

export type SourceKind = 'device' | 'bridge' | 'simulated';

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'streaming'
  | 'error';

/** Per-channel band powers (µV²) plus relative share of total (0..1). */
export interface BandPowers {
  absolute: Record<BandName, number>;
  relative: Record<BandName, number>;
}

export interface SpectrumFrame {
  /** Frequency for each bin, Hz (0 .. ~45). */
  frequencies: Float32Array;
  /** Power spectral density magnitude per bin, per channel (µV²/Hz). */
  perChannel: Record<ChannelName, Float32Array>;
  /** Mean across all four channels. */
  mean: Float32Array;
}

export interface MentalState {
  /** 0..100 — higher = more focused (beta / (alpha + theta)). */
  concentration: number;
  /** 0..100 — higher = more relaxed (alpha / (alpha + beta)). */
  relaxation: number;
  /** 0..100 — theta-relative drowsiness / mind-wandering indicator. */
  drowsiness: number;
}

export interface EegSnapshot {
  /** Latest N samples per channel, µV, oldest first. */
  waveform: Record<ChannelName, Float32Array>;
  /** Timestamp (ms) for each sample in waveform, aligned by index. */
  waveformTimes: Float32Array;
  spectrum: SpectrumFrame;
  bands: Record<ChannelName, BandPowers>;
  /** Averaged over channels. */
  bandsMean: BandPowers;
  mental: MentalState;
  /** Rolling history of mental state (~ last 60s at 4Hz). */
  history: { t: number; concentration: number; relaxation: number; drowsiness: number }[];
  /** Signal quality per channel 0..1 (1 = clean). Derived from amplitude. */
  quality: Record<ChannelName, number>;
  samplesReceived: number;
  sampleRate: number;
}

export interface DeviceInfo {
  name: string;
  model?: string;
  serial?: string;
  firmwareVersion?: string;
  batteryCharge?: number;
}

export interface EegSample {
  /** µV per channel, in CHANNELS order. */
  values: [number, number, number, number];
  t: number;
}

export interface SignalSource {
  readonly kind: SourceKind;
  connect(): Promise<DeviceInfo>;
  start(onSample: (s: EegSample) => void): Promise<void>;
  stop(): Promise<void>;
  disconnect(): Promise<void>;
  onDisconnect(cb: () => void): void;
  onBattery?(cb: (pct: number) => void): void;
}
