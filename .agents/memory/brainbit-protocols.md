---
name: BrainBit hardware generations
description: Which BrainBit headbands Web Bluetooth can talk to and why the local Python bridge exists
---
Only the original BrainBit exposes the Nordic-UART-style service `6e400001-b534-f393-68a9-e50e24dcca9e` that the `web-neurosdk-brainbit` npm package (and any browser code) uses. BrainBit 2 / Flex / Black use an undocumented protocol shipped only in the closed NeuroSDK 2 binaries (Python: `pyneurosdk2`).

**Why:** The user's headband (found in the picker, then "No Services matching UUID") is second-gen; direct browser support is impossible without reverse engineering.
**How to apply:** Don't spend time hunting for a JS SDK for BrainBit 2 — route those devices through the local bridge (`bridge/`). The npm SDK also filters the picker by the exact name "BrainBit"; the app widens that filter by wrapping `navigator.bluetooth.requestDevice` during `connect()`.
