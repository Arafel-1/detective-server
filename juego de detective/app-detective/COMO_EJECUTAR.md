# Instrucciones para Ejecutar Enigma Files

## Opción 1: Instalar Python (Recomendado - Más Fácil)

1. **Descarga Python:**
   - Ve a: https://www.python.org/downloads/
   - Descarga la última versión
   - **IMPORTANTE:** Durante la instalación, marca la casilla "Add Python to PATH"

2. **Ejecuta el servidor:**
   - Haz doble clic en `INICIAR_SERVIDOR.bat`
   - Abre tu navegador en: http://localhost:8000

## Opción 2: Usar Navegador con Extensión

### Si usas Chrome:
1. Instala la extensión "Web Server for Chrome"
2. Abre la extensión
3. Selecciona la carpeta `app-detective`
4. Haz clic en el enlace que te da

### Si usas VS Code:
1. Instala la extensión "Live Server"
2. Abre la carpeta `app-detective` en VS Code
3. Clic derecho en `index.html` → "Open with Live Server"

## Opción 3: Usar Node.js

1. **Descarga Node.js:**
   - Ve a: https://nodejs.org/
   - Descarga la versión LTS
   - Instala normalmente

2. **Ejecuta el servidor:**
   - Haz doble clic en `INICIAR_SERVIDOR.bat`
   - Abre tu navegador en: http://localhost:8000

## ¿Por qué necesito un servidor?

Los navegadores modernos bloquean la carga de archivos PDF desde archivos HTML locales por seguridad. Un servidor local resuelve este problema.

## Problemas Comunes

**"No se puede acceder a este sitio"**
- Asegúrate de que el servidor esté corriendo (ventana de comandos abierta)
- Verifica que la URL sea exactamente: http://localhost:8000

**"Error al cargar PDF"**
- Verifica que los archivos PDF estén en: `app-detective/assets/casos/caso1/`
- Asegúrate de estar usando un servidor, no abriendo el HTML directamente
