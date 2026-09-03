#!/usr/bin/env python3
"""
Start all Kissan Rehnuma development services, each in its own terminal window.

Usage:
    python scripts/dev/start_all.py

Each service opens in a separate terminal so logs are easy to read.
Close each terminal window individually, or run the matching stop script.
"""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import List

ROOT = Path(__file__).resolve().parents[2]
IS_WINDOWS = platform.system() == "Windows"


class Service:
    def __init__(self, name: str, cwd: Path, command: List[str]):
        self.name = name
        self.cwd = cwd
        self.command = command


def choose_python(cwd: Path) -> str:
    """Pick the right Python interpreter for a service directory."""
    venv_python = cwd / ".venv" / ("Scripts" if IS_WINDOWS else "bin") / ("python.exe" if IS_WINDOWS else "python")
    if venv_python.exists():
        return str(venv_python)
    return sys.executable


def find_npm() -> str:
    """Return the full path to npm if possible, otherwise 'npm'."""
    npm_cmd = "npm.cmd" if IS_WINDOWS else "npm"
    path = shutil.which(npm_cmd)
    return path if path else npm_cmd


def build_services() -> List[Service]:
    """Define every service and its startup command."""
    services: List[Service] = []

    services.append(Service(
        name="frontend",
        cwd=ROOT / "mobile-web-app",
        command=[find_npm(), "start"],
    ))

    services.append(Service(
        name="api-gateway",
        cwd=ROOT / "api-gateway",
        command=[
            choose_python(ROOT / "api-gateway"),
            "-m", "uvicorn",
            "app.main:app",
            "--reload",
            "--host", "127.0.0.1",
            "--port", "3000",
        ],
    ))

    microservices = [
        ("crop-disease", ROOT / "services" / "crop-disease-service", 8001, True),
        ("user-auth", ROOT / "services" / "user-auth-service", 8002, False),
        ("animal-disease", ROOT / "services" / "animal-disease-service", 8003, False),
        ("weather-alert", ROOT / "services" / "weather-alert-service", 8004, False),
        ("market-rate", ROOT / "services" / "market-rate-service", 8005, False),
    ]

    for name, cwd, port, uses_uv in microservices:
        if uses_uv and (cwd / "uv.lock").exists():
            command = ["uv", "run", "uvicorn", "app.main:app", "--reload", "--port", str(port)]
        else:
            command = [
                choose_python(cwd),
                "-m", "uvicorn",
                "app.main:app",
                "--reload",
                "--port", str(port),
            ]
        services.append(Service(name=name, cwd=cwd, command=command))

    voice_cwd = ROOT / "services" / "voice-agent-service"

    # Token server for LiveKit JWT generation and agent dispatch
    services.append(Service(
        name="token-server",
        cwd=voice_cwd,
        command=[choose_python(voice_cwd), "token_server.py"],
    ))

    # LiveKit voice agent worker
    services.append(Service(
        name="voice-agent",
        cwd=voice_cwd,
        command=[choose_python(voice_cwd), "-m", "app.main", "dev"],
    ))

    return services


def launch_in_new_terminal(service: Service) -> None:
    """Open a new terminal window and run the service inside it."""
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"

    # We change to the service directory first, then run the command.
    cwd = str(service.cwd)
    cmd_str = " ".join(f'"{arg}"' if " " in arg else arg for arg in service.command)

    if IS_WINDOWS:
        # Create a temporary batch file to avoid nested-quote escaping issues
        # with cmd.exe /k. The batch file changes directory and runs the command.
        bat_dir = Path(tempfile.gettempdir()) / "krn-launcher"
        bat_dir.mkdir(exist_ok=True)
        bat_file = bat_dir / f"start_{service.name}.bat"
        bat_file.write_text(
            f'@echo off\n'
            f'cd /d "{cwd}"\n'
            f'{cmd_str}\n',
            encoding="utf-8",
        )
        # /k keeps the window open after the command finishes so errors are visible.
        terminal_cmd = f'start "KRN {service.name}" cmd /k "{bat_file}"'
        subprocess.Popen(terminal_cmd, env=env, shell=True, close_fds=True)
    else:
        # macOS/Linux: try common terminal emulators.
        terminal_cmd = None
        shell_cmd = f'cd "{cwd}" && {cmd_str}; exec bash'
        for term in ["gnome-terminal", "konsole", "xfce4-terminal", "xterm"]:
            if shutil.which(term):
                terminal_cmd = [term, "--", "bash", "-c", shell_cmd]
                break
        if terminal_cmd is None:
            # Fallback: run in background via nohup.
            terminal_cmd = ["nohup", "bash", "-c", shell_cmd]
        subprocess.Popen(terminal_cmd, env=env, close_fds=True)


def main() -> int:
    services = build_services()

    print("=" * 70)
    print("Kissan Rehnuma — Development Service Launcher")
    print("=" * 70)
    print(f"Root: {ROOT}")
    print(f"Platform: {platform.system()}")
    print(f"Services to start: {len(services)}")
    for svc in services:
        print(f"  - {svc.name:14s} -> {' '.join(svc.command)}")
    print("=" * 70)
    print("Each service will open in its own terminal window.\n")

    for service in services:
        print(f"Launching {service.name} in new terminal...")
        launch_in_new_terminal(service)
        time.sleep(0.8)  # Stagger so windows don't all appear at once.

    print("\nAll services launched. Close each terminal window to stop it.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
