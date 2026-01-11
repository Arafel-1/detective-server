@echo off
echo ===================================================
echo   CONFIGURACION FINAL DE GIT (SOLO UNA VEZ)
echo ===================================================
echo.
echo Git necesita saber quien eres para subir los cambios.
echo Escribe los datos que usaste en GitHub (o ficticios, da igual).
echo.

set /p email="Tu Email: "
set /p name="Tu Nombre (o usuario): "

echo.
echo Configurandonos...
git config --global user.email "%email%"
git config --global user.name "%name%"

echo.
echo Intentando subir cambios de nuevo...
:: Intentamos el commit de nuevo por si fallo antes
git commit -m "Configuracion inicial nube" --allow-empty

echo.
echo Estableciendo conexion Maestra (Upstream)...
git push --set-upstream origin main

echo.
if %errorlevel% equ 0 (
    echo [EXITO] ¡Todo configurado!
    echo A partir de ahora solo usa 'actualizar_nube.bat'
) else (
    echo [ERROR] Algo fallo. Verifica que tienes permiso en el repositorio.
)
pause
