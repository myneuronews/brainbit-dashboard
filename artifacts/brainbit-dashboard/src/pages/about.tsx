import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function About() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 flex flex-col gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">About BrainBit Dashboard</h1>
        <p className="text-muted-foreground">A real-time neurofeedback visualizer running entirely in your browser.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Browser:</strong> Google Chrome or Microsoft Edge on Desktop (Web Bluetooth required).</li>
            <li><strong>Hardware:</strong> BrainBit EEG Headband, charged and turned on.</li>
            <li><strong>Placement:</strong> Ensure all four electrodes (O1, O2, T3, T4) make good contact with the skin.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Electrode Positions</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          <p className="mb-2">The BrainBit uses a 4-channel configuration:</p>
          <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
            <li><strong>O1 & O2 (Occipital):</strong> Located at the back of the head. Primary visual processing area, highly responsive to closing your eyes (Alpha waves increase).</li>
            <li><strong>T3 & T4 (Temporal):</strong> Located on the sides above the ears. Associated with auditory processing, memory, and emotion.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Frequency Bands</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm leading-relaxed">
          <div><strong className="text-foreground">Delta (1-4 Hz):</strong> Deep sleep, restorative states.</div>
          <div><strong className="text-foreground">Theta (4-8 Hz):</strong> Light sleep, deep meditation, intuition.</div>
          <div><strong className="text-foreground">Alpha (8-13 Hz):</strong> Relaxed, reflective, awake but resting (especially with eyes closed).</div>
          <div><strong className="text-foreground">Beta (13-30 Hz):</strong> Alert, working, active thinking.</div>
          <div><strong className="text-foreground">Gamma (30-45 Hz):</strong> High-level information processing, sudden insight.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mental Indices</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3">
          <p className="text-sm">The dashboard computes three primary real-time indices based on band ratios:</p>
          <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
            <li><strong>Concentration:</strong> Beta / (Alpha + Theta). Higher when you are actively focused on a task.</li>
            <li><strong>Relaxation:</strong> Alpha / (Alpha + Beta). Higher when you let go of active thoughts.</li>
            <li><strong>Drowsiness:</strong> A measure of slow-wave dominance indicating tiredness or mind-wandering.</li>
          </ul>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground text-center bg-muted/50 p-5 rounded-lg border border-border">
        <strong>Disclaimer:</strong> This dashboard is for personal exploration and educational purposes only. It is not a medical device and should not be used to diagnose or treat any medical conditions.
      </div>
    </div>
  );
}
