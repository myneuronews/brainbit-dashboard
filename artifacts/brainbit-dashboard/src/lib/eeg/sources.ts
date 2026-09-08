import type { Subscription } from 'web-neurosdk-brainbit';
import {
  SAMPLE_RATE,
  type DeviceInfo,
  type EegSample,
  type SignalSource,
} from './types';

const V_TO_UV = 1e6;

const BRAINBIT_SERVICE = '6e400001-b534-f393-68a9-e50e24dcca9e';
const DEVICE_INFORMATION_SERVICE = 0x180a;

/**
 * The official SDK only lists devices whose name is exactly "BrainBit", which
 * hides headbands advertising as "BrainBit2", "BrainBitBlack", "BrainBit Flex",
 * etc. While the SDK's connect() runs, swap in a broader picker filter.
 */
async function withWidenedDeviceFilter<T>(run: () => Promise<T>): Promise<T> {
  const bt = navigator.bluetooth;
  const original = bt.requestDevice.bind(bt);
  bt.requestDevice = () =>
    original({
      filters: [
        { namePrefix: 'BrainBit' },
        { namePrefix: 'Brainbit' },
        { namePrefix: 'BB' },
        { namePrefix: 'NeuroBB' },
        { services: [BRAINBIT_SERVICE] },
      ],
      optionalServices: [BRAINBIT_SERVICE, DEVICE_INFORMATION_SERVICE],
    });
  try {
    return await run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/No Services matching UUID|getPrimaryService/i.test(msg)) {
      throw new Error(
        'Connected to the device, but it does not expose the BrainBit signal service. It may already be linked to another app or phone, or be a model this web SDK does not support.',
      );
    }
    throw e;
  } finally {
    bt.requestDevice = original;
  }
}

/** Real BrainBit headband over Web Bluetooth via the official web SDK. */
export class BrainbitDeviceSource implements SignalSource {
  readonly kind = 'device' as const;
  private client: import('web-neurosdk-brainbit').default | null = null;
  private eegSub: Subscription | null = null;
  private statusSub: Subscription | null = null;
  private connSub: Subscription | null = null;
  private disconnectCb: (() => void) | null = null;
  private batteryCb: ((pct: number) => void) | null = null;

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  async connect(): Promise<DeviceInfo> {
    if (!BrainbitDeviceSource.isSupported()) {
      throw new Error(
        'Web Bluetooth is not available in this browser. Use Chrome or Edge on a laptop or desktop.',
      );
    }
    const { default: BrainbitClient } = await import('web-neurosdk-brainbit');
    const client = new BrainbitClient();
    this.client = client;
    await withWidenedDeviceFilter(() => client.connect());

    this.connSub = client.connectionStatus.subscribe((connected) => {
      if (!connected) this.disconnectCb?.();
    });
    if (client.statusData) {
      this.statusSub = client.statusData.subscribe((s) => {
        if (typeof s.batteryCharge === 'number') this.batteryCb?.(s.batteryCharge);
      });
    }

    const info = await client.deviceInfo();
    let battery: number | undefined;
    try {
      battery = (await client.checkStatus()).batteryCharge;
    } catch {
      battery = undefined;
    }
    return {
      name: info.name,
      model: info.model,
      firmwareVersion: info.firmwareVersion,
      batteryCharge: battery,
    };
  }

  async start(onSample: (s: EegSample) => void): Promise<void> {
    const client = this.client;
    if (!client?.eegStream) throw new Error('Device is not connected.');
    // Two samples per BLE packet at 250 Hz -> 4 ms apart.
    const dt = 1000 / SAMPLE_RATE;
    this.eegSub?.unsubscribe();
    this.eegSub = client.eegStream.subscribe((p) => {
      const now = performance.now();
      onSample({
        t: now - dt,
        values: [
          p.val0_ch1 * V_TO_UV,
          p.val0_ch2 * V_TO_UV,
          p.val0_ch3 * V_TO_UV,
          p.val0_ch4 * V_TO_UV,
        ],
      });
      onSample({
        t: now,
        values: [
          p.val1_ch1 * V_TO_UV,
          p.val1_ch2 * V_TO_UV,
          p.val1_ch3 * V_TO_UV,
          p.val1_ch4 * V_TO_UV,
        ],
      });
    });
    const status = await client.startEEGStream();
    if (status.name !== 'NSS2_STATUS_SIGNAL') {
      throw new Error(`Headband refused to start streaming: ${status.message}`);
    }
  }

  async stop(): Promise<void> {
    this.eegSub?.unsubscribe();
    this.eegSub = null;
    try {
      await this.client?.stopEEGStream();
    } catch {
      /* device may already be gone */
    }
  }

  async disconnect(): Promise<void> {
    await this.stop();
    this.statusSub?.unsubscribe();
    this.connSub?.unsubscribe();
    try {
      this.client?.disconnect();
    } catch {
      /* ignore */
    }
    this.client = null;
  }

  onDisconnect(cb: () => void): void {
    this.disconnectCb = cb;
  }

  onBattery(cb: (pct: number) => void): void {
    this.batteryCb = cb;
  }
}

/**
 * Synthetic EEG for development and demos: pink-ish noise plus alpha/beta/theta
 * rhythms whose balance slowly drifts, so the dashboard visibly reacts.
 */
export class SimulatedSource implements SignalSource {
  readonly kind = 'simulated' as const;
  private timer: ReturnType<typeof setInterval> | null = null;
  private phase = 0;
  private lastT = 0;
  private disconnectCb: (() => void) | null = null;

  async connect(): Promise<DeviceInfo> {
    return { name: 'Simulated BrainBit', model: 'Demo signal', batteryCharge: 100 };
  }

  async start(onSample: (s: EegSample) => void): Promise<void> {
    this.stopTimer();
    this.lastT = performance.now();
    const dt = 1000 / SAMPLE_RATE;
    const offsets = [0, 0.7, 1.9, 2.6];
    this.timer = setInterval(() => {
      const now = performance.now();
      // Emit however many samples elapsed since last tick, keeping true 250 Hz.
      let n = Math.min(50, Math.floor((now - this.lastT) / dt));
      while (n-- > 0) {
        this.lastT += dt;
        this.phase += 1 / SAMPLE_RATE;
        const t = this.phase;
        // Slow drift 0..1 controlling focus (period ~40s).
        const focus = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 40);
        const alphaAmp = 12 * (1 - focus) + 3;
        const betaAmp = 6 * focus + 2;
        const thetaAmp = 5 * (1 - focus) + 2;
        const values = offsets.map((o, i) => {
          const eyesClosedBoost = i < 2 ? 1.3 : 1; // occipital alpha stronger
          return (
            alphaAmp * eyesClosedBoost * Math.sin(2 * Math.PI * 10 * t + o) +
            betaAmp * Math.sin(2 * Math.PI * 20 * t + o * 2) +
            thetaAmp * Math.sin(2 * Math.PI * 6 * t + o * 3) +
            1.5 * Math.sin(2 * Math.PI * 2 * t + o) +
            (Math.random() - 0.5) * 8
          );
        }) as [number, number, number, number];
        onSample({ t: this.lastT, values });
      }
    }, 20);
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async stop(): Promise<void> {
    this.stopTimer();
  }

  async disconnect(): Promise<void> {
    this.stopTimer();
  }

  onDisconnect(cb: () => void): void {
    this.disconnectCb = cb;
  }
}

export const DEFAULT_BRIDGE_URL = 'ws://localhost:8765';

/** Quick reachability probe: opens a socket and closes it as soon as it answers. */
export function probeBridge(url: string = DEFAULT_BRIDGE_URL, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      resolve(false);
      return;
    }
    const done = (ok: boolean) => {
      clearTimeout(timer);
      ws.onopen = ws.onerror = ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    ws.onopen = () => done(true);
    ws.onerror = () => done(false);
  });
}

type BridgeMessage =
  | { type: 'hello'; name: string; model?: string; serial?: string; battery?: number | null; sampleRate: number }
  | { type: 'samples'; values: number[][] }
  | { type: 'battery'; pct: number }
  | { type: 'status'; message: string }
  | { type: 'error'; message: string };

/**
 * Local bridge: a Python helper on the user's laptop (see /bridge) uses BrainBit's
 * official NeuroSDK 2 and forwards samples over a localhost WebSocket. This is the
 * path for BrainBit 2 / Flex / Black, which Web Bluetooth cannot talk to directly.
 */
export class BridgeSource implements SignalSource {
  readonly kind = 'bridge' as const;
  private ws: WebSocket | null = null;
  private onSample: ((s: EegSample) => void) | null = null;
  private disconnectCb: (() => void) | null = null;
  private batteryCb: ((pct: number) => void) | null = null;
  private lastT = 0;

  constructor(private url: string = DEFAULT_BRIDGE_URL) {}

  connect(): Promise<DeviceInfo> {
    return new Promise<DeviceInfo>((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(this.url);
      this.ws = ws;
      const fail = (msg: string) => {
        if (settled) return;
        settled = true;
        reject(new Error(msg));
      };
      // Connect-phase watchdog: the bridge scans for up to ~15 s before answering.
      const watchdog = setTimeout(
        () => fail('The bridge did not find a headband in time. Check the bridge window for details.'),
        45000,
      );
      ws.onerror = () => {
        fail(
          `Could not reach the local bridge at ${this.url}. Start it with "python brainbit_bridge.py" on this computer, then try again.`,
        );
      };
      ws.onclose = () => {
        clearTimeout(watchdog);
        if (!settled) fail('The bridge closed the connection before the headband was ready.');
        else this.disconnectCb?.();
      };
      ws.onmessage = (ev) => {
        let msg: BridgeMessage;
        try {
          msg = JSON.parse(ev.data as string) as BridgeMessage;
        } catch {
          return;
        }
        switch (msg.type) {
          case 'hello':
            clearTimeout(watchdog);
            settled = true;
            resolve({
              name: msg.name,
              model: msg.model,
              serial: msg.serial,
              batteryCharge: typeof msg.battery === 'number' ? msg.battery : undefined,
            });
            break;
          case 'samples': {
            const cb = this.onSample;
            if (!cb) break;
            const dt = 1000 / SAMPLE_RATE;
            const now = performance.now();
            // Spread the batch back out to 4 ms spacing ending "now".
            let t = now - dt * (msg.values.length - 1);
            if (t < this.lastT) t = this.lastT + dt;
            for (const v of msg.values) {
              cb({ t, values: [v[0], v[1], v[2], v[3]] });
              this.lastT = t;
              t += dt;
            }
            break;
          }
          case 'battery':
            this.batteryCb?.(msg.pct);
            break;
          case 'error':
            fail(msg.message);
            break;
          case 'status':
            break;
        }
      };
    });
  }

  async start(onSample: (s: EegSample) => void): Promise<void> {
    this.onSample = onSample;
    this.ws?.send(JSON.stringify({ type: 'start' }));
  }

  async stop(): Promise<void> {
    this.onSample = null;
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'stop' }));
  }

  async disconnect(): Promise<void> {
    this.onSample = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  }

  onDisconnect(cb: () => void): void {
    this.disconnectCb = cb;
  }

  onBattery(cb: (pct: number) => void): void {
    this.batteryCb = cb;
  }
}
