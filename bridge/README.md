# BrainBit local bridge

Second-generation BrainBit headbands (BrainBit 2, Flex, Black) do not speak the
protocol that Chrome's Web Bluetooth library understands. This small program runs
on your laptop, talks to the headband through BrainBit's official NeuroSDK 2, and
forwards the EEG samples to the web dashboard.

## Windows: the easy way (no typing)

1. Download this whole `bridge` folder to your PC (e.g. `C:\brainbit-bridge`).
2. Turn the headband on and close the BrainBit phone app.
3. Double-click **`Start BrainBit Bridge.bat`**. The first time it installs Python (if needed)
   and the BrainBit SDK by itself; after that it starts in a second. Leave the window open.
4. Open the dashboard in Chrome. It notices the bridge and shows a **Connect headband** button.

Close the bridge window when you're done.

## Manual way

    pip install -r requirements.txt
    python brainbit_bridge.py

## Options

    python brainbit_bridge.py --serial 040308CB   # connect only to this headband
    python brainbit_bridge.py --timeout 30        # scan longer
    python brainbit_bridge.py --port 9000         # different port (enter it in the dashboard)

## Troubleshooting

- **"No BrainBit headband found"** — headband asleep or paired to another device; make sure
  Windows Bluetooth is on. You do *not* need to pair it in Windows Settings; the SDK finds it directly.
- **Dashboard says it can't reach the bridge** — the bridge isn't running, or a firewall prompt
  was dismissed. Allow Python on private networks when Windows asks.
- **`pip` not recognised** — reinstall Python with "Add to PATH" ticked, or use `py -m pip ...`
  and `py brainbit_bridge.py`.
