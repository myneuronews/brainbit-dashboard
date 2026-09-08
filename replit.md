# BrainBit EEG Dashboard

A Chrome web app that pairs with a BrainBit EEG headband over Web Bluetooth and shows live brain waves, a frequency spectrum with band powers, and concentration/relaxation indices.

## Run & Operate

- Frontend workflow: `artifacts/brainbit-dashboard: web` (Vite, reads `PORT`/`BASE_PATH` from the workflow)
- `pnpm --filter @workspace/brainbit-dashboard run typecheck` — verify the app
- `pnpm run typecheck` — full typecheck across all packages
- The shared API server exists but this app does not use it; the app is fully client-side.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + shadcn/ui, wouter routing
- Headband link: `web-neurosdk-brainbit` (official BrainBit Web Bluetooth SDK, UMD build, bundles rxjs 6)

## Where things live

- `artifacts/brainbit-dashboard/src/lib/eeg/` — device-agnostic signal layer
  - `types.ts` — sample rate (250 Hz), channel names (O1, O2, T3, T4), band ranges, snapshot shape
  - `sources.ts` — `BrainbitDeviceSource` (real headband via SDK) and `SimulatedSource` (synthetic demo signal)
  - `dsp.ts` — radix-2 FFT, Hann-windowed PSD, band powers, mental-state heuristics, contact quality
  - `engine.ts` — ring buffer + 10 Hz analysis tick that emits `EegSnapshot`
- `artifacts/brainbit-dashboard/src/hooks/use-eeg.ts` — the single React entry point for all live data and connect/stream actions
- `artifacts/brainbit-dashboard/src/types/web-neurosdk-brainbit.d.ts` — hand-written types for the untyped SDK

## Architecture decisions

- SDK EEG values are volts; the source layer converts to µV before anything else sees them.
- Analysis runs on a 512-sample (~2 s) Hann window, spectrum capped at 45 Hz; mental indices are EMA-smoothed so gauges don't jitter.
- Concentration = beta / (alpha + theta); relaxation = alpha / (alpha + beta); drowsiness = (theta + delta) share. These are classic neurofeedback ratios, not clinical measures.
- Web Bluetooth requires a user gesture and Chrome/Edge on desktop; the hook exposes `bluetoothSupported` and the simulated source so the UI works everywhere.

## Local bridge (BrainBit 2 / Flex / Black)

- `bridge/brainbit_bridge.py` — Python script the user runs on their own laptop; uses `pyneurosdk2` (official NeuroSDK 2) and streams µV samples over `ws://localhost:8765`. Protocol is documented at the top of the file; the browser side is `BridgeSource` in `sources.ts`.
- It cannot run on Replit (no Bluetooth here); to test the dashboard side, run any WebSocket server that speaks the protocol on 8765.

## Gotchas

- Second-generation headbands (BrainBit 2, Flex, Black) do NOT expose the original `6e400001-...` GATT service, so Web Bluetooth pairing fails with "No Services matching UUID". Their protocol is only available inside the closed-source NeuroSDK 2 — hence the local bridge.

- The SDK's `connect()` filters devices by the exact name `BrainBit`; a headband advertising a different name will not appear in the pairing dialog.
- Web Bluetooth only works over HTTPS (the Replit preview and published URL are fine) and not inside cross-origin iframes with restrictive permissions — open the preview in its own tab if pairing fails.
