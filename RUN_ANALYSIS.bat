@echo off
echo ========================================
echo   ANALISIS DE DATOS DEL CASO
echo ========================================
echo.
echo Instalando herramienta de lectura PDF...
call npm install pdf-parse
echo.
echo Extrayendo informacion confidencial...
node analyze_solution.js
echo.
echo ========================================
echo   LISTO!
echo   Por favor regresa al chat con el agente.
echo ========================================
pause
