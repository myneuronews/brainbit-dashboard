import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EegEngine } from '@/lib/eeg/engine';
import { BrainbitDeviceSource, BridgeSource, SimulatedSource } from '@/lib/eeg/sources';
import type {
  ConnectionState,
  DeviceInfo,
  EegSnapshot,
  SignalSource,
  SourceKind,
} from '@/lib/eeg/types';

export interface UseEegResult {
  /** idle -> connecting -> connected -> streaming; 'error' carries `error`. */
  state: ConnectionState;
  error: string | null;
  source: SourceKind | null;
  device: DeviceInfo | null;
  /** Live battery percentage when the headband reports it. */
  battery: number | null;
  /** Latest analysed frame, ~10x per second while streaming. Null before any data. */
  snapshot: EegSnapshot | null;
  /** True when the browser exposes Web Bluetooth (Chrome/Edge desktop). */
  bluetoothSupported: boolean;
  /**
   * True when the app is running inside an embedded frame (e.g. a preview pane).
   * Browsers block Bluetooth pairing in frames; the app must be opened in its own tab.
   */
  inFrame: boolean;
  /** Open the browser's Bluetooth picker and pair a BrainBit headband. */
  connectDevice: () => Promise<void>;
  /** Use the built-in synthetic signal (no hardware needed). */
  connectSimulated: () => Promise<void>;
  /** Connect through the local Python bridge (BrainBit 2 / Flex / Black). */
  connectBridge: (url?: string) => Promise<void>;
  startStream: () => Promise<void>;
  stopStream: () => Promise<void>;
  disconnect: () => Promise<void>;
}

function isInFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function useEeg(): UseEegResult {
  const engine = useMemo(() => new EegEngine(), []);
  const sourceRef = useRef<SignalSource | null>(null);
  const [state, setState] = useState<ConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<SourceKind | null>(null);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<EegSnapshot | null>(null);

  useEffect(() => {
    const off = engine.onSnapshot(setSnapshot);
    return () => {
      off();
    };
  }, [engine]);

  useEffect(() => {
    return () => {
      engine.stopTicking();
      void sourceRef.current?.disconnect();
    };
  }, [engine]);

  const fail = useCallback((e: unknown) => {
    let msg = e instanceof Error ? e.message : String(e);
    if (/permissions policy/i.test(msg)) {
      msg =
        'Bluetooth pairing is blocked inside an embedded preview. Open the app in its own browser tab and try again.';
    }
    // User closed the Bluetooth picker: not an error worth shouting about.
    if (/cancel/i.test(msg) && /user/i.test(msg)) {
      setState('idle');
      setError(null);
      return;
    }
    setError(msg);
    setState('error');
  }, []);

  const disconnect = useCallback(async () => {
    engine.stopTicking();
    const s = sourceRef.current;
    sourceRef.current = null;
    if (s) await s.disconnect();
    setState('idle');
    setSource(null);
    setDevice(null);
    setBattery(null);
    setSnapshot(null);
    setError(null);
    engine.reset();
  }, [engine]);

  const startStream = useCallback(async () => {
    const s = sourceRef.current;
    if (!s) return;
    try {
      engine.reset();
      await s.start(engine.push);
      engine.startTicking(10);
      setState('streaming');
    } catch (e) {
      fail(e);
    }
  }, [engine, fail]);

  const stopStream = useCallback(async () => {
    const s = sourceRef.current;
    if (!s) return;
    engine.stopTicking();
    await s.stop();
    setState('connected');
  }, [engine]);

  const connectWith = useCallback(
    async (s: SignalSource) => {
      await disconnect();
      setState('connecting');
      setError(null);
      try {
        s.onDisconnect(() => {
          if (sourceRef.current === s) {
            engine.stopTicking();
            sourceRef.current = null;
            setState('idle');
            setSource(null);
            setError('The headband disconnected.');
          }
        });
        s.onBattery?.((pct) => setBattery(pct));
        const info = await s.connect();
        sourceRef.current = s;
        setDevice(info);
        if (typeof info.batteryCharge === 'number') setBattery(info.batteryCharge);
        setSource(s.kind);
        setState('connected');
        // Auto-start so the dashboard comes alive immediately after pairing.
        engine.reset();
        await s.start(engine.push);
        engine.startTicking(10);
        setState('streaming');
      } catch (e) {
        sourceRef.current = null;
        fail(e);
      }
    },
    [disconnect, engine, fail],
  );

  const connectDevice = useCallback(
    () => connectWith(new BrainbitDeviceSource()),
    [connectWith],
  );
  const connectBridge = useCallback(
    (url?: string) => connectWith(new BridgeSource(url)),
    [connectWith],
  );
  const connectSimulated = useCallback(
    () => connectWith(new SimulatedSource()),
    [connectWith],
  );

  return {
    state,
    error,
    source,
    device,
    battery,
    snapshot,
    bluetoothSupported: BrainbitDeviceSource.isSupported(),
    inFrame: isInFrame(),
    connectDevice,
    connectSimulated,
    connectBridge,
    startStream,
    stopStream,
    disconnect,
  };
}
