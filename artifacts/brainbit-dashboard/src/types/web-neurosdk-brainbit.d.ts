declare module 'web-neurosdk-brainbit' {
  export interface Subscription { unsubscribe(): void }
  export interface Observable<T> { subscribe(next: (value: T) => void): Subscription }
  export type Subject<T> = Observable<T>;
  export type BehaviorSubject<T> = Observable<T>;

  export interface BrainbitStatus {
    name:
      | 'NSS2_STATUS_INVALID'
      | 'NSS2_STATUS_STOPED'
      | 'NSS2_STATUS_SIGNAL'
      | 'NSS2_STATUS_RESIST'
      | 'NSS2_STATUS_BOOTLOADER_NEED';
    value: number;
    message: string;
  }

  export interface BrainbitStatusData {
    status: BrainbitStatus;
    cmdError: { name: string; value: number; message: string };
    batteryCharge: number;
    firmwareVersion: number;
  }

  export interface BrainbitEegPacket {
    number: number;
    marker: boolean;
    val0_ch1: number;
    val0_ch2: number;
    val0_ch3: number;
    val0_ch4: number;
    val1_ch1: number;
    val1_ch2: number;
    val1_ch3: number;
    val1_ch4: number;
  }

  export interface BrainbitResistanceData {
    resistanceCh1: number;
    resistanceCh2: number;
    resistanceCh3: number;
    resistanceCh4: number;
  }

  export interface BrainbitDeviceInfo {
    model?: string;
    hardwareRevision?: string;
    firmwareVersion?: string;
    name: string;
    deviceId?: string;
    state: 'CONNECTED' | 'DISCONNECTED';
  }

  export default class BrainbitClient {
    connectionStatus: BehaviorSubject<boolean>;
    statusData: Observable<BrainbitStatusData> | null;
    eegStream: Subject<BrainbitEegPacket> | null;
    resistanceData: Subject<BrainbitResistanceData> | null;
    eventMarkers: Subject<{ value: string; timestamp: number }> | null;
    connect(): Promise<void>;
    checkStatus(): Promise<BrainbitStatusData>;
    startEEGStream(): Promise<BrainbitStatus>;
    stopEEGStream(): Promise<BrainbitStatus>;
    startResistanceData(): Promise<BrainbitStatus>;
    stopResistanceData(): Promise<BrainbitStatus>;
    deviceInfo(): Promise<BrainbitDeviceInfo>;
    injectMarker(value: string, timestamp?: number): Promise<void>;
    disconnect(): void;
  }
}
