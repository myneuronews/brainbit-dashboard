import React, { useEffect, useRef, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BandName, BandPowers, SpectrumFrame } from '@/lib/eeg/types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// MetricCard
export const MetricCard = memo(function MetricCard({ title, value, color, hero }: { title: string, value: number, color: string, hero?: boolean }) {
  return (
    <Card className="relative overflow-hidden bg-card border-card-border h-[140px]">
      <CardContent className="p-6 flex flex-col items-center justify-center h-full relative z-10">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-semibold">{title}</div>
        <div 
          className={`font-mono font-bold ${hero ? 'text-6xl' : 'text-5xl'}`} 
          style={{ color, textShadow: `0 0 20px ${color}60` }}
        >
          {Math.round(value)}
        </div>
      </CardContent>
      <div 
        className="absolute inset-0 opacity-[0.03] z-0 pointer-events-none" 
        style={{ background: `radial-gradient(circle at center, ${color} 0%, transparent 70%)` }}
      />
    </Card>
  );
});

// QualityCard
export const QualityCard = memo(function QualityCard({ quality }: { quality: Record<string, number> }) {
  const CHANNELS = ['O1', 'O2', 'T3', 'T4'];
  return (
    <Card className="flex flex-col justify-center bg-card border-card-border h-[140px]">
      <CardHeader className="py-4 px-4 pb-0 items-center justify-center h-[40%]">
        <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground text-center">Contact Quality</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 flex flex-1 items-center justify-center gap-2 sm:gap-4 w-full">
        {CHANNELS.map((ch) => {
          const q = quality[ch] ?? 0;
          const isGood = q > 0.8;
          const isOk = q > 0.4 && q <= 0.8;
          const colorClass = isGood ? 'text-green-400 bg-green-400/10 border-green-400/30' : 
                             isOk ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' : 
                                    'text-red-400 bg-red-400/10 border-red-400/30';
          return (
            <div key={ch} className={`flex flex-col items-center justify-center w-10 h-10 rounded-full border ${colorClass} transition-colors duration-300`}>
              <span className="text-xs font-mono font-bold">{ch}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
});

// BandBalance
const BAND_LABELS: Record<BandName, string> = {
  delta: 'Delta (1-4 Hz)',
  theta: 'Theta (4-8 Hz)',
  alpha: 'Alpha (8-13 Hz)',
  beta: 'Beta (13-30 Hz)',
  gamma: 'Gamma (30-45 Hz)',
};

const BAND_COLORS_CSS: Record<BandName, string> = {
  delta: 'hsl(240, 10%, 40%)',
  theta: 'hsl(280, 80%, 65%)',
  alpha: 'hsl(185, 100%, 60%)',
  beta: 'hsl(140, 70%, 60%)',
  gamma: 'hsl(45, 90%, 60%)',
};

const BAND_ORDER: BandName[] = ['gamma', 'beta', 'alpha', 'theta', 'delta'];

export const BandBalance = memo(function BandBalance({ bands }: { bands: BandPowers }) {
  if (!bands) return null;
  return (
    <div className="flex flex-col gap-4">
      {BAND_ORDER.map((band) => {
        const rel = bands.relative[band] || 0;
        return (
          <div key={band} className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground items-center">
              <span className="font-medium">{BAND_LABELS[band]}</span>
              <span className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded text-foreground">{(rel * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2.5 w-full bg-muted/50 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${Math.max(rel * 100, 1)}%`, backgroundColor: BAND_COLORS_CSS[band] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});

// HistoryChart
export const HistoryChart = memo(function HistoryChart({ history }: { history: any[] }) {
  if (!history || history.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={history} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} hide />
        <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip 
          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
          labelFormatter={() => ''}
        />
        <Line type="monotone" dataKey="concentration" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="relaxation" stroke="hsl(var(--secondary))" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="drowsiness" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
});

// WaveformCanvas
interface WaveformProps {
  data: Float32Array;
  color: string;
  height?: number;
}
export const WaveformCanvas = memo(function WaveformCanvas({ data, color, height = 70 }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    
    if (canvas.width !== width * dpr || canvas.height !== h * dpr) {
      canvas.width = width * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    } else {
      ctx.clearRect(0, 0, width, h);
    }

    if (!data || data.length === 0) return;

    let maxAbs = 50; 
    for (let i = 0; i < data.length; i++) {
      const val = Math.abs(data[i]);
      if (val > maxAbs) maxAbs = val;
    }
    maxAbs *= 1.1;

    const centerY = h / 2;
    const scaleY = (h / 2) / maxAbs;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';

    const step = width / (data.length - 1);
    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      const y = centerY - (data[i] * scaleY);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.stroke();
    ctx.shadowBlur = 0;

  }, [data, color]);

  return <canvas ref={canvasRef} className="w-full block" style={{ height }} />;
});

// SpectrumCanvas
interface SpectrumProps {
  frame: SpectrumFrame;
  height?: number;
}
const BAND_RANGES: Record<BandName, [number, number]> = {
  delta: [1, 4],
  theta: [4, 8],
  alpha: [8, 13],
  beta: [13, 30],
  gamma: [30, 45],
};
const SPECTRUM_BAND_COLORS: Record<BandName, string> = {
  delta: 'rgba(120, 120, 130, 0.15)',
  theta: 'rgba(200, 120, 220, 0.15)',
  alpha: 'rgba(100, 220, 255, 0.15)',
  beta: 'rgba(100, 255, 140, 0.15)',
  gamma: 'rgba(255, 180, 100, 0.15)',
};
export const SpectrumCanvas = memo(function SpectrumCanvas({ frame, height = 200 }: SpectrumProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    
    if (canvas.width !== width * dpr || canvas.height !== h * dpr) {
      canvas.width = width * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    } else {
      ctx.clearRect(0, 0, width, h);
    }

    if (!frame || frame.frequencies.length === 0) return;

    const freqs = frame.frequencies;
    const power = frame.mean;
    const maxFreq = 45; 

    let maxP = 0.1;
    for (let i = 0; i < freqs.length; i++) {
      if (freqs[i] > 1 && freqs[i] <= maxFreq && power[i] > maxP) {
        maxP = power[i];
      }
    }
    maxP *= 1.2;

    const scaleX = width / maxFreq;
    const scaleY = h / maxP;

    Object.entries(BAND_RANGES).forEach(([b, range]) => {
      const band = b as BandName;
      const xStart = range[0] * scaleX;
      const w = (range[1] - range[0]) * scaleX;
      ctx.fillStyle = SPECTRUM_BAND_COLORS[band];
      ctx.fillRect(xStart, 0, w, h);
    });

    ctx.beginPath();
    ctx.strokeStyle = 'hsl(var(--primary))';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    let started = false;
    let lastX = 0;
    for (let i = 0; i < freqs.length; i++) {
      const f = freqs[i];
      if (f > maxFreq) break;
      const x = f * scaleX;
      lastX = x;
      const y = h - (Math.min(power[i], maxP) * scaleY);
      
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    if (started) {
       ctx.lineTo(lastX, h);
       ctx.lineTo(0, h);
       ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
       ctx.fill();
       ctx.shadowColor = 'hsl(var(--primary))';
       ctx.shadowBlur = 8;
       ctx.stroke();
       ctx.shadowBlur = 0;
    }

  }, [frame]);

  return <canvas ref={canvasRef} className="w-full block" style={{ height }} />;
});
