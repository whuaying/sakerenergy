@echo off
setlocal
set "WANZHI_SETUP_PYTHON=%~dp0backend\.venv-wanzhi\Scripts\pythonw.exe"
if not exist "%WANZHI_SETUP_PYTHON%" (
  echo Missing Python environment: backend\.venv-wanzhi
  echo Follow docs\integrations\wanzhi\LOCAL-RUN.md to install it first.
  pause
  exit /b 1
)
start "" "%WANZHI_SETUP_PYTHON%" "%~dp0backend\wanzhi_setup_gui.pyw"
