"""
BrainBit local bridge
=====================

Connects to a BrainBit headband (original, BrainBit 2, Flex, Black) using the
official NeuroSDK 2 Python package and streams EEG samples to the web dashboard
over a local WebSocket (ws://localhost:8765).

Run it on the laptop that has the Bluetooth adapter:

    pip install -r requirements.txt
    python brainbit_bridge.py

Then open the dashboard in Chrome and choose "Local bridge".

Protocol (JSON text frames)
  server -> client
    {"type":"hello","name":str,"model":str,"serial":str,"battery":int|null,"sampleRate":250}
    {"type":"samples","values":[[o1,o2,t3,t4], ...]}   # microvolts, oldest first
    {"type":"battery","pct":int}
    {"type":"status","message":str}
    {"type":"error","message":str}
  client -> server
    {"type":"start"} | {"type":"stop"}
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import threading
import time
from typing import Any

def _pip_install_requirements() -> bool:
    import subprocess

    req = os.path.join(os.path.dirname(os.path.abspath(__file__)), "requirements.txt")
    cmd = [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "-r", req]
    return subprocess.call(cmd) == 0


try:
    import websockets
    from websockets.asyncio.server import serve
except ImportError:  # pragma: no cover
    print("Installing bridge dependencies for this Python (one time)...", flush=True)
    if not _pip_install_requirements():
        print("Installing dependencies failed - check your internet connection.", file=sys.stderr)
        sys.exit(1)
    import websockets
    from websockets.asyncio.server import serve


def _import_sdk():
    from neurosdk.cmn_types import SensorCommand, SensorFamily  # noqa: F401
    from neurosdk.scanner import Scanner  # noqa: F401

    return SensorCommand, SensorFamily, Scanner


def _load_sdk():
    """Import pyneurosdk2, installing it into *this* interpreter if it is missing."""
    import platform
    import traceback

    error: BaseException | None = None
    try:
        return _import_sdk()
    except ModuleNotFoundError as exc:
        error = exc
        print("BrainBit SDK not found for this Python - installing it now (one time)...", flush=True)
        if _pip_install_requirements():
            try:
                return _import_sdk()
            except BaseException as exc2:  # noqa: BLE001
                error = exc2
        else:
            print("pip install failed (see output above).", file=sys.stderr)
    except BaseException as exc:  # noqa: BLE001
        error = exc

    print("\nThe BrainBit SDK (pyneurosdk2) could not be loaded. Details:\n", file=sys.stderr)
    traceback.print_exception(error)
    bits = platform.architecture()[0]
    print(
        f"\nPython {platform.python_version()} ({bits}) at {sys.executable}\n"
        "\nThings that fix this most often:\n"
        "  1. The SDK needs 64-bit Python (3.7 or newer) on Windows 10/11. "
        f"You have {bits}, {platform.python_version()}.\n"
        "  2. Install the Microsoft Visual C++ Redistributable (x64):\n"
        "     https://aka.ms/vs/17/release/vc_redist.x64.exe  then run the bridge again.\n"
        "  3. If several Pythons are installed, run:  py -3.12 -m pip install -r requirements.txt\n",
        file=sys.stderr,
    )
    sys.exit(1)


SensorCommand, SensorFamily, Scanner = _load_sdk()

CHANNELS = ["O1", "O2", "T3", "T4"]
V_TO_UV = 1e6
FAMILIES = [
    f
    for f in (
        getattr(SensorFamily, "LEBrainBit", None),
        getattr(SensorFamily, "LEBrainBit2", None),
        getattr(SensorFamily, "LEBrainBitBlack", None),
        getattr(SensorFamily, "LEBrainBitFlex", None),
        getattr(SensorFamily, "LEHeadband", None),
    )
    if f is not None
]


def log(msg: str) -> None:
    print(f"[bridge] {msg}", flush=True)


class Headband:
    """Thin wrapper around a NeuroSDK sensor that normalises samples to [O1,O2,T3,T4] µV."""

    def __init__(self, on_samples, on_status):
        self.on_samples = on_samples  # callable(list[list[float]])
        self.on_status = on_status  # callable(str)
        self.sensor: Any = None
        self.channel_map: list[int] | None = None  # index into Samples[] for each of CHANNELS
        self.streaming = False

    # ---- discovery / connection -------------------------------------------------
    def connect(self, timeout_s: float = 15.0, serial: str | None = None) -> dict:
        self.on_status("Scanning for BrainBit headbands...")
        scanner = Scanner(FAMILIES)
        scanner.start()
        deadline = time.time() + timeout_s
        info = None
        try:
            while time.time() < deadline:
                found = scanner.sensors()
                if serial:
                    found = [s for s in found if str(s.SerialNumber) == serial]
                if found:
                    info = found[0]
                    break
                time.sleep(0.5)
        finally:
            scanner.stop()
        if info is None:
            raise RuntimeError(
                "No BrainBit headband found. Make sure it is switched on, charged, "
                "not connected to the phone app, and Bluetooth is enabled on this computer."
            )
        self.on_status(f"Connecting to {info.Name} ({info.SerialNumber})...")
        self.sensor = scanner.create_sensor(info)
        self._prepare_channels()
        battery = None
        try:
            battery = int(self.sensor.batt_power)
        except Exception:
            pass
        model = str(getattr(info, "SensFamily", "")).replace("SensorFamily.", "")
        return {
            "name": str(info.Name),
            "model": model,
            "serial": str(info.SerialNumber),
            "battery": battery,
        }

    def _prepare_channels(self) -> None:
        """BrainBit 2 delivers a Samples[] array; map it to O1/O2/T3/T4 order."""
        sensor = self.sensor
        supported = getattr(sensor, "supported_channels", None)
        if not supported:
            self.channel_map = None  # original BrainBit: packets carry O1/O2/T3/T4 attributes
            return
        by_name: dict[str, int] = {}
        for ch in supported:
            ident = str(getattr(ch, "Id", "")).split(".")[-1]
            by_name[ident] = int(ch.Num)
        if all(n in by_name for n in CHANNELS):
            self.channel_map = [by_name[n] for n in CHANNELS]
        else:
            # Unknown layout: take the first four channels in order.
            nums = sorted(int(ch.Num) for ch in supported)[:4]
            self.channel_map = (nums + [nums[-1]] * 4)[:4]
            log(f"Channel positions not O1/O2/T3/T4, using channel numbers {self.channel_map}")

    # ---- streaming ----------------------------------------------------------------
    def _on_signal(self, _sensor, packets) -> None:
        rows: list[list[float]] = []
        for p in packets:
            if self.channel_map is None:
                rows.append([float(getattr(p, n)) * V_TO_UV for n in CHANNELS])
            else:
                s = p.Samples
                rows.append([float(s[i]) * V_TO_UV for i in self.channel_map])
        if rows:
            self.on_samples(rows)

    def start(self) -> None:
        if self.streaming:
            return
        self.sensor.signalDataReceived = self._on_signal
        self.sensor.exec_command(SensorCommand.StartSignal)
        self.streaming = True
        self.on_status("Streaming EEG")

    def stop(self) -> None:
        if not self.streaming:
            return
        try:
            self.sensor.exec_command(SensorCommand.StopSignal)
        finally:
            self.sensor.signalDataReceived = None
            self.streaming = False

    def battery(self) -> int | None:
        try:
            return int(self.sensor.batt_power)
        except Exception:
            return None

    def disconnect(self) -> None:
        try:
            self.stop()
        except Exception:
            pass
        try:
            if self.sensor is not None:
                self.sensor.disconnect()
        except Exception:
            pass
        self.sensor = None


async def handle_client(ws, args) -> None:
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def push(msg: dict) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, msg)

    headband = Headband(
        on_samples=lambda rows: push({"type": "samples", "values": rows}),
        on_status=lambda m: (log(m), push({"type": "status", "message": m})),
    )

    async def sender() -> None:
        # Coalesce sample packets so we send ~25 frames/s instead of one per BLE packet.
        while True:
            msg = await queue.get()
            if msg["type"] == "samples":
                rows = list(msg["values"])
                await asyncio.sleep(0.04)
                while not queue.empty():
                    nxt = queue.get_nowait()
                    if nxt["type"] == "samples":
                        rows.extend(nxt["values"])
                    else:
                        await ws.send(json.dumps(nxt))
                await ws.send(json.dumps({"type": "samples", "values": rows}))
            else:
                await ws.send(json.dumps(msg))

    async def battery_poller() -> None:
        while True:
            await asyncio.sleep(15)
            pct = await asyncio.to_thread(headband.battery)
            if pct is not None:
                push({"type": "battery", "pct": pct})

    send_task = asyncio.create_task(sender())
    batt_task = None
    log("Dashboard connected")
    try:
        try:
            info = await asyncio.to_thread(headband.connect, args.timeout, args.serial)
        except Exception as e:  # noqa: BLE001
            log(f"Connection failed: {e}")
            push({"type": "error", "message": str(e)})
            await asyncio.sleep(0.2)
            return
        push({"type": "hello", **info, "sampleRate": 250})
        batt_task = asyncio.create_task(battery_poller())
        await asyncio.to_thread(headband.start)

        async for raw in ws:
            try:
                cmd = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if cmd.get("type") == "start":
                await asyncio.to_thread(headband.start)
            elif cmd.get("type") == "stop":
                await asyncio.to_thread(headband.stop)
                push({"type": "status", "message": "Paused"})
    except websockets.ConnectionClosed:
        pass
    except Exception as e:  # noqa: BLE001
        log(f"Error: {e}")
        try:
            await ws.send(json.dumps({"type": "error", "message": str(e)}))
        except Exception:
            pass
    finally:
        send_task.cancel()
        if batt_task:
            batt_task.cancel()
        await asyncio.to_thread(headband.disconnect)
        log("Dashboard disconnected, headband released")


async def main() -> None:
    parser = argparse.ArgumentParser(description="BrainBit -> dashboard WebSocket bridge")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--timeout", type=float, default=15.0, help="scan timeout in seconds")
    parser.add_argument("--serial", type=str, default=None, help="only connect to this serial number")
    args = parser.parse_args()

    async with serve(lambda ws: handle_client(ws, args), "localhost", args.port, max_size=None):
        log(f"Listening on ws://localhost:{args.port}")
        log("Open the dashboard in Chrome and choose 'Local bridge'. Press Ctrl+C to quit.")
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
