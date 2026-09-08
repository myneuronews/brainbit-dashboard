@echo off
title BrainBit Bridge
cd /d "%~dp0"

echo.
echo  BrainBit Bridge - keep this window open while using the dashboard.
echo.

rem ---- find Python ----------------------------------------------------------
set PY=
py -3 --version >nul 2>&1 && set PY=py -3
if not defined PY python --version >nul 2>&1 && set PY=python

if not defined PY (
  echo  Python is not installed yet. Installing it now with Windows Package Manager...
  echo  ^(A Windows prompt may ask for permission - click Yes.^)
  winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements --silent
  if errorlevel 1 (
    echo.
    echo  Automatic install failed. Please install Python from https://www.python.org/downloads/
    echo  ^(tick "Add python.exe to PATH"^), then double-click this file again.
    pause
    exit /b 1
  )
  echo  Python installed. Please double-click this file again to continue.
  pause
  exit /b 0
)

rem ---- the BrainBit driver DLL needs the Visual C++ runtime -----------------
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" /v Installed >nul 2>&1
if errorlevel 1 (
  echo  Installing the Microsoft Visual C++ runtime needed by the BrainBit driver...
  echo  ^(A Windows prompt may ask for permission - click Yes.^)
  winget install --id Microsoft.VCRedist.2015+.x64 -e --accept-source-agreements --accept-package-agreements --silent
)

rem ---- run -------------------------------------------------------------------
echo  Starting... (the first run installs the BrainBit SDK, which takes a minute)
echo  Then open the dashboard in Chrome and click "Connect headband".
echo.
%PY% brainbit_bridge.py %*
if errorlevel 1 (
  echo.
  echo  The bridge stopped with an error ^(see above^).
  pause
)
