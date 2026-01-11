@echo off
echo ===================================================
echo   SUBIENDO CAMBIOS A LA NUBE (GITHUB + RENDER)
echo ===================================================
echo.

:: Verificar si git esta instalado
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No encuentro 'git' instalado. Por favor instala Git for Windows.
    pause
    exit /b
)

:: Mostrar estado actual
echo 1. Comprobando cambios...
git status -s

echo.
echo 2. Agregando archivos...
git add .

echo.
echo 3. Guardando cambios (Commit)...
set /p commit_msg="Escribe una descripcion corta de los cambios (ej: arreglos visuales): "
if "%commit_msg%"=="" set commit_msg="Actualizacion automatica"
git commit -m "%commit_msg%"

echo.
echo 4. Enviando a GitHub...
git push

echo.
if %errorlevel% equ 0 (
    echo [EXITO] Cambios subidos correctamente!
    echo Render detectará esto y actualizará el servidor en unos minutos.
) else (
    echo [ERROR] Hubo un problema al subir. Verifica tu conexion o credenciales.
)

echo.
pause
