@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo Pipeline de leads - Chile completo
echo ==========================================
echo.

set "PYTHON_CMD="

where py >nul 2>nul
if %errorlevel%==0 (
  set "PYTHON_CMD=py -3"
)

if not defined PYTHON_CMD (
  where python >nul 2>nul
  if %errorlevel%==0 (
    set "PYTHON_CMD=python"
  )
)

if not defined PYTHON_CMD (
  where python3 >nul 2>nul
  if %errorlevel%==0 (
    set "PYTHON_CMD=python3"
  )
)

if not defined PYTHON_CMD (
  echo ERROR: No se encontro Python. Instala Python o agrega py/python al PATH.
  echo.
  pause
  exit /b 1
)

echo Ejecutando pipeline con: %PYTHON_CMD%
echo.
%PYTHON_CMD% procesar_por_regiones.py
set "PIPELINE_EXIT=%errorlevel%"

echo.
if not "%PIPELINE_EXIT%"=="0" (
  echo ERROR: El pipeline termino con errores. Revisa el reporte anterior.
  echo.
  pause
  exit /b %PIPELINE_EXIT%
)

echo Proceso completado correctamente.
echo.
pause
