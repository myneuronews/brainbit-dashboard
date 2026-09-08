import { useEeg } from '@/hooks/use-eeg';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Bluetooth, BluetoothOff, Activity, AlertCircle, Battery, Pause, Play, ExternalLink, Cable } from 'lucide-react';
import { DEFAULT_BRIDGE_URL, probeBridge } from '@/lib/eeg/sources';
import { useEffect, useState } from 'react';
import { WaveformCanvas, SpectrumCanvas, HistoryChart, BandBalance, QualityCard, MetricCard } from '@/components/dashboard-components';

function WaveformRow({ channel, data, color }: { channel: string, data: Float32Array, color: string }) {
  return (
    <div className="flex h-[80px] relative items-center">
      <div className="w-16 flex justify-center items-center h-full border-r border-border bg-muted/20">
        <span className="text-sm font-mono font-bold" style={{ color }}>{channel}</span>
      </div>
      <div className="flex-1 min-w-0 w-full pl-2 pr-2 py-1 h-full flex flex-col justify-center overflow-hidden">
        <WaveformCanvas data={data} color={color} height={70} />
      </div>
    </div>
  )
}

const BRIDGE_URL_KEY = 'brainbit.bridgeUrl';
/** True when running inside the Windows desktop app, which embeds the bridge. */
const IS_DESKTOP = new URLSearchParams(window.location.search).get('desktop') === '1';

export function Dashboard() {
  const eeg = useEeg();
  const [bridgeUrl, setBridgeUrl] = useState(() => localStorage.getItem(BRIDGE_URL_KEY) ?? DEFAULT_BRIDGE_URL);
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);
  const connectBridge = () => {
    localStorage.setItem(BRIDGE_URL_KEY, bridgeUrl);
    void eeg.connectBridge(bridgeUrl);
  };

  // While idle, keep checking whether the local bridge is running so the
  // connect screen can offer it as the obvious one-click choice.
  useEffect(() => {
    if (eeg.state !== 'idle') return;
    let cancelled = false;
    const check = async () => {
      const ok = await probeBridge(bridgeUrl);
      if (!cancelled) setBridgeOnline(ok);
    };
    void check();
    const id = setInterval(check, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [eeg.state, bridgeUrl]);

  // Desktop app: the bridge runs in-process, so connect as soon as it answers.
  useEffect(() => {
    if (IS_DESKTOP && eeg.state === 'idle' && bridgeOnline) connectBridge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eeg.state, bridgeOnline]);

  if (eeg.state === 'idle' && IS_DESKTOP) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-8 relative">
          <div className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
          <Brain className="w-12 h-12 text-primary relative z-10" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Starting up...</h1>
        <p className="text-lg text-muted-foreground mb-10">Turn your BrainBit headband on. Connection starts automatically.</p>
        <Button size="lg" variant="outline" className="border-primary/20 hover:bg-primary/10 text-primary font-semibold" onClick={eeg.connectSimulated}>
          <Activity className="w-5 h-5 mr-2" />
          Try Simulated Signal instead
        </Button>
      </div>
    );
  }

  if (eeg.state === 'idle') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-8 relative">
          <div className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
          <Brain className="w-12 h-12 text-primary relative z-10" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-foreground">Observe your mind.</h1>
        <p className="text-lg text-muted-foreground mb-12">
          Connect your BrainBit headband to stream clinical-grade EEG data, analyze frequency bands, and track your mental states locally in your browser.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          {bridgeOnline && (
            <Button size="lg" className="h-14 px-8 text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" onClick={connectBridge}>
              <Cable className="w-5 h-5 mr-2" />
              Connect headband
            </Button>
          )}
          {bridgeOnline ? null : eeg.bluetoothSupported && eeg.inFrame ? (
            <div className="flex flex-col items-center gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20 max-w-sm text-sm">
              <Bluetooth className="w-5 h-5 text-primary" />
              <p className="text-muted-foreground">Browsers block Bluetooth pairing inside an embedded preview. Open the app in its own tab to pair your headband.</p>
              <Button asChild size="lg" className="h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                <a href={window.location.href} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in a new tab
                </a>
              </Button>
            </div>
          ) : eeg.bluetoothSupported ? (
            <Button size="lg" className="h-14 px-8 text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" onClick={eeg.connectDevice}>
              <Bluetooth className="w-5 h-5 mr-2" />
              Pair BrainBit Headband
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-2 p-4 bg-destructive/10 rounded-lg border border-destructive/20 max-w-sm text-sm text-destructive-foreground">
              <BluetoothOff className="w-5 h-5 mb-1" />
              <p>Web Bluetooth is not supported in this browser. Please use Chrome or Edge on Desktop to connect hardware.</p>
            </div>
          )}
          <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-primary/20 hover:bg-primary/10 text-primary font-semibold" onClick={eeg.connectSimulated}>
            <Activity className="w-5 h-5 mr-2" />
            Try Simulated Signal
          </Button>
        </div>

        <div className="mt-10 w-full max-w-xl text-left rounded-lg border border-border bg-card/60 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Cable className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">BrainBit 2, Flex or Black? Use the local bridge</h2>
            <span
              className={`ml-auto inline-flex items-center gap-1.5 text-xs font-medium ${bridgeOnline ? 'text-emerald-400' : 'text-muted-foreground'}`}
            >
              <span className={`h-2 w-2 rounded-full ${bridgeOnline ? 'bg-emerald-400' : 'bg-muted-foreground/50'}`} />
              {bridgeOnline === null ? 'Checking' : bridgeOnline ? 'Bridge running' : 'Bridge not detected'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Newer headbands need BrainBit's official SDK, which browsers cannot run. Double-click{' '}
            <code className="font-mono text-xs">Start BrainBit Bridge.bat</code> from the project's{' '}
            <code className="font-mono text-xs">bridge</code> folder on this PC. This page notices it automatically
            and the connect button appears above.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="flex-1 h-11 rounded-md border border-input bg-background px-3 font-mono text-sm"
              value={bridgeUrl}
              onChange={(e) => setBridgeUrl(e.target.value)}
              aria-label="Bridge address"
              spellCheck={false}
            />
            <Button size="lg" className="h-11 px-6 font-semibold" onClick={connectBridge}>
              <Cable className="w-4 h-4 mr-2" />
              Local bridge
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (eeg.state === 'connecting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6 relative">
          <div className="absolute inset-0 rounded-full animate-ping bg-primary/30" style={{ animationDuration: '1.5s' }} />
          <Bluetooth className="w-10 h-10 text-primary animate-pulse relative z-10" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Connecting to device...</h2>
        <p className="text-muted-foreground">Make sure your headband is turned on and nearby. Through the bridge this can take up to 20 seconds while it scans.</p>
      </div>
    );
  }

  if (eeg.state === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-destructive" />
        </div>
        <h2 className="text-2xl font-semibold mb-2 text-destructive">Connection Failed</h2>
        <p className="text-muted-foreground max-w-md mb-8">{eeg.error}</p>
        <div className="flex gap-3">
          {IS_DESKTOP && (
            <Button size="lg" onClick={connectBridge}>
              <Cable className="w-4 h-4 mr-2" />
              Try again
            </Button>
          )}
          {eeg.inFrame && (
            <Button asChild size="lg">
              <a href={window.location.href} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in a new tab
              </a>
            </Button>
          )}
          <Button size="lg" variant={eeg.inFrame || IS_DESKTOP ? 'outline' : 'default'} onClick={IS_DESKTOP ? eeg.connectSimulated : eeg.disconnect}>
            {IS_DESKTOP ? 'Use simulated signal' : 'Go Back'}
          </Button>
        </div>
      </div>
    );
  }

  if (!eeg.snapshot) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-medium">Initializing stream...</h2>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-6 container mx-auto max-w-7xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            {eeg.source === 'simulated' ? 'Simulated Signal' : eeg.device?.name || 'BrainBit'}
          </h2>
          {eeg.battery !== null && (
            <div className={`flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-md border ${
              eeg.battery > 20 ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
            }`}>
              <Battery className="w-4 h-4" /> {eeg.battery}%
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {eeg.state === 'streaming' ? (
            <Button variant="outline" size="sm" onClick={eeg.stopStream} className="w-28 text-foreground hover:text-foreground">
              <Pause className="w-4 h-4 mr-2"/> Pause
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={eeg.startStream} className="w-28 border-primary/50 text-primary hover:bg-primary/10">
              <Play className="w-4 h-4 mr-2"/> Resume
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={eeg.disconnect}>
            Disconnect
          </Button>
        </div>
      </div>

      <div className={`transition-opacity duration-300 ${eeg.state === 'connected' ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <MetricCard title="Concentration" value={eeg.snapshot.mental.concentration} color="hsl(var(--primary))" hero />
          <MetricCard title="Relaxation" value={eeg.snapshot.mental.relaxation} color="hsl(var(--secondary))" />
          <MetricCard title="Drowsiness" value={eeg.snapshot.mental.drowsiness} color="hsl(var(--accent))" />
          <QualityCard quality={eeg.snapshot.quality} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <Card>
              <CardHeader className="py-3 px-4 border-b border-border">
                <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between items-center">
                  <span>Live Waveforms</span>
                  <span className="font-mono text-xs bg-muted px-2 py-1 rounded text-foreground">{eeg.snapshot.sampleRate} Hz</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex flex-col divide-y divide-border">
                <WaveformRow channel="O1" data={eeg.snapshot.waveform.O1} color="hsl(var(--chart-1))" />
                <WaveformRow channel="O2" data={eeg.snapshot.waveform.O2} color="hsl(var(--chart-2))" />
                <WaveformRow channel="T3" data={eeg.snapshot.waveform.T3} color="hsl(var(--chart-3))" />
                <WaveformRow channel="T4" data={eeg.snapshot.waveform.T4} color="hsl(var(--chart-4))" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3 px-4 border-b border-border">
                <CardTitle className="text-sm font-medium text-muted-foreground">60s Trend</CardTitle>
              </CardHeader>
              <CardContent className="p-4 h-[240px]">
                <HistoryChart history={eeg.snapshot.history} />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4">
            <Card>
              <CardHeader className="py-3 px-4 border-b border-border">
                <CardTitle className="text-sm font-medium text-muted-foreground">Power Spectrum (0-45 Hz)</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <SpectrumCanvas frame={eeg.snapshot.spectrum} height={200} />
              </CardContent>
            </Card>

            <Card className="flex-1">
              <CardHeader className="py-3 px-4 border-b border-border">
                <CardTitle className="text-sm font-medium text-muted-foreground">Band Balance</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <BandBalance bands={eeg.snapshot.bandsMean} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
