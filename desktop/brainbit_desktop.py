"""
BrainBit Dashboard - Windows desktop app.

Runs three things in one process:
  1. the BrainBit bridge (NeuroSDK 2 -> WebSocket on localhost:8765)
  2. a tiny static file server for the built dashboard UI
  3. a native window (Edge WebView2 via pywebview) showing the dashboard

Packaged into a single .exe by PyInstaller (see .github/workflows/desktop.yml).
"""

from __future__ import annotations

import asyncio
import functools
import http.server
import os
import socket
import sys
import threading
from pathlib import Path

HERE = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
# In the PyInstaller bundle, bridge/ and ui/ sit next to this file.
BRIDGE_DIR = HERE / "bridge" if (HERE / "bridge").exists() else HERE.parent / "bridge"
UI_DIR = HERE / "ui" if (HERE / "ui").exists() else HERE.parent / "artifacts" / "brainbit-dashboard" / "dist" / "public"
BRIDGE_PORT = 8765

sys.path.insert(0, str(BRIDGE_DIR))


def _fatal(title: str, message: str) -> None:
    """Show an error in a native dialog (the packaged app has no console) and exit."""
    print(f"{title}: {message}", file=sys.stderr)
    if sys.platform == "win32":
        import ctypes

        ctypes.windll.user32.MessageBoxW(None, message, title, 0x10)
    sys.exit(1)


try:
    import brainbit_bridge  # loads NeuroSDK2; calls sys.exit with details if the driver can't load
except SystemExit:
    _fatal(
        "BrainBit Dashboard",
        "The BrainBit driver could not be loaded.\n\n"
        "Install the Microsoft Visual C++ Redistributable (x64) from\n"
        "https://aka.ms/vs/17/release/vc_redist.x64.exe and start the app again.",
    )

import webview  # noqa: E402


class _Args:
    port = BRIDGE_PORT
    timeout = 15.0
    serial = os.environ.get("BRAINBIT_SERIAL") or None


def run_bridge() -> None:
    async def _serve() -> None:
        from websockets.asyncio.server import serve

        async with serve(
            lambda ws: brainbit_bridge.handle_client(ws, _Args()), "localhost", BRIDGE_PORT, max_size=None
        ):
            brainbit_bridge.log(f"Bridge listening on ws://localhost:{BRIDGE_PORT}")
            await asyncio.Future()

    asyncio.run(_serve())


class _SpaHandler(http.server.SimpleHTTPRequestHandler):
    """Serves the built UI; unknown paths fall back to index.html (client-side routing)."""

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(UI_DIR), **kw)

    def translate_path(self, path: str) -> str:
        full = super().translate_path(path)
        if not os.path.exists(full):
            return str(UI_DIR / "index.html")
        return full

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *_: object) -> None:  # keep the console quiet
        pass


def run_ui_server() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), _SpaHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return port


def main() -> None:
    if not (UI_DIR / "index.html").exists():
        print(f"Dashboard UI not found at {UI_DIR}. Build it first (pnpm --filter @workspace/brainbit-dashboard build).")
        sys.exit(1)

    threading.Thread(target=run_bridge, daemon=True).start()
    ui_port = run_ui_server()

    webview.create_window(
        "BrainBit Dashboard",
        f"http://127.0.0.1:{ui_port}/?desktop=1",
        width=1280,
        height=860,
        min_size=(900, 600),
        background_color="#0b0d12",
    )
    webview.start()


if __name__ == "__main__":
    main()
