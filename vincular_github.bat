@echo off
echo ===================================================
echo   VINCULAR CARPETA CON GITHUB
echo ===================================================
echo.
echo Este paso solo se hace UNA VEZ.
echo.

:: 1. Iniciar Git
echo 1. Iniciando repositorio local...
git init
git branch -M main

:: 2. Pedir URL
echo.
echo Ve a tu repositorio en GitHub y busca el boton verde "Code".
echo Copia la URL que aparece ahi (termina en .git).
echo.
set /p repo_url="Pega la URL del repositorio aqui y pulsa Enter: "

:: 3. Conectar
echo.
echo 2. Conectando con la nube...
git remote add origin %repo_url%

:: 4. Sincronizar (IMPORTANTE: Traer lo que subiste manualmente primero)
echo.
echo 3. Sincronizando archivos...
git pull origin main --allow-unrelated-histories

echo.
echo ===================================================
echo   ¡LISTO! Ahora ya puedes usar 'actualizar_nube.bat'
echo ===================================================
echo.
pause
