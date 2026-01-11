@echo off
title Servidor Enigma Files
color 0A
cls
echo.
echo ========================================
echo   ENIGMA FILES - Servidor Local
echo ========================================
echo.

cd /d "%~dp0"

echo Verificando Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Node.js no se encuentra
    echo.
    echo Si acabas de instalar Node.js:
    echo 1. Cierra TODAS las ventanas de comandos
    echo 2. Vuelve a ejecutar este archivo
    echo.
    echo Si el problema persiste, reinicia tu PC
    echo.
    pause
    exit /b 1
)

echo Node.js encontrado!
echo.
echo Iniciando servidor en http://localhost:8000
echo.
echo IMPORTANTE: Deja esta ventana abierta
echo Presiona Ctrl+C para detener el servidor
echo.
echo ========================================
echo.

node server.js

pause
