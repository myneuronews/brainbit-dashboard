# BrainBit Dashboard – Windows desktop app

One `.exe` that contains the dashboard UI, the BrainBit bridge and an embedded browser window.
Nothing to install: download `BrainBitDashboard.exe` from the GitHub **Releases** page and double-click it.

Requirements: Windows 10/11 (64-bit), Bluetooth, and Microsoft Edge WebView2 (preinstalled on
Windows 11 and most Windows 10 machines; otherwise the app tells you where to get it).

## How it is built

`.github/workflows/desktop.yml` runs on every push to `main`:

1. `build-ui` (Linux): builds the web dashboard with pnpm/Vite.
2. `build-exe` (Windows): bundles `desktop/brainbit_desktop.py`, `bridge/` and the built UI with PyInstaller
   and publishes `BrainBitDashboard.exe` as a GitHub Release (`desktop-<run number>`).

## Running from source (Windows)

    pip install -r desktop/requirements.txt
    set PORT=5000 && set BASE_PATH=/ && pnpm --filter @workspace/brainbit-dashboard build
    python desktop/brainbit_desktop.py
