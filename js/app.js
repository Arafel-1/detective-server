// Datos de los casos
// Estado de la aplicación
let casesData = []; // Se cargará del servidor o caché
let casesLoaded = false;

// Estado actual de la aplicación
let currentCase = null;
let currentTab = 'pistas';

// Navegación entre pantallas
function showHome() {
    console.log('Mostrando pantalla de inicio');
    hideAllScreens();
    document.getElementById('home-screen').classList.add('active');
}

function showCaseSelection() {
    console.log('Mostrando selección de casos');
    hideAllScreens();
    document.getElementById('case-selection-screen').classList.add('active');
    loadCases();
}

function showSettings() {
    console.log('Mostrando ajustes');
    hideAllScreens();
    document.getElementById('settings-screen').classList.add('active');

    // Cargar valor actual
    const input = document.getElementById('server-url-input');
    const configGroup = document.getElementById('server-config-group');

    if (input && window.Config) {
        input.value = window.Config.baseUrl;

        // Si ya estamos usando la URL de producción, ocultamos la opción para no confundir
        // (Opcional: Se puede dejar visible para debug, pero el usuario pidió "metadato oculto")
        if (window.Config.defaultUrl.includes('onrender.com')) {
            if (configGroup) configGroup.style.display = 'none';
        }
    }
}

function showCase(caseId) {
    console.log('Mostrando caso:', caseId);
    currentCase = casesData.find(c => c.id === caseId);
    if (!currentCase) return;

    // Sincronización Multijugador:
    // ELIMINADO: Ya no enviamos actualización aquí para evitar bucles infinitos.
    // El cambio de caso global solo ocurre explícitamente desde el Lobby (startGame)
    // o mediante un botón específico de "Mover Grupo" si se implementara en el futuro.

    hideAllScreens();
    document.getElementById('case-screen').classList.add('active');
    document.getElementById('case-title').textContent = currentCase.title;

    // Configurar sistema de notas para este caso
    if (window.notesSystem) {
        window.notesSystem.setCaseId(caseId);
    }

    // Resetear a la primera pestaña
    currentTab = 'pistas';
    updateTabs();
    loadDocuments();

    // Abrir automáticamente el reporte policial inicial
    setTimeout(() => {
        openDocument('reporte_policial_inicial.pdf', 'Reporte Policial Inicial');
    }, 500);
}

function showSolution() {
    console.log('Abriendo modal de resolución');
    if (!currentCase) return;

    // Abrir el sistema de evaluación
    if (window.evaluationSystem) {
        window.evaluationSystem.openResolution();
    } else {
        console.error('Sistema de evaluación no inicializado');
        // Fallback
        hideAllScreens();
        document.getElementById('solution-screen').classList.add('active');
        loadSolution();
    }
}

function backToCase() {
    console.log('Volviendo al caso');
    hideAllScreens();
    document.getElementById('case-screen').classList.add('active');
}

function showCaseSelection() {
    console.log('Mostrando selección de casos');
    hideAllScreens();

    // Ocultar notas si estaban visibles
    if (window.notesSystem) {
        window.notesSystem.hide();
    }

    document.getElementById('case-selection-screen').classList.add('active');
    loadCases();
}

function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
}

// Cargar casos en la pantalla de selección
async function loadCases() {
    const container = document.getElementById('cases-container');
    container.innerHTML = '<p class="loading-msg">Buscan casos nuevos...</p>';

    // 1. Intentar cargar del servidor si no están cargados
    if (!casesLoaded) {
        try {
            console.log("Solicitando casos al servidor...");

            // Función de fetch con reintentos para manejar "Cold Start" de Render
            const fetchWithRetry = async (url, retries = 3, delay = 2000) => {
                for (let i = 0; i < retries; i++) {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout por intento

                        const response = await fetch(url, { signal: controller.signal });
                        clearTimeout(timeoutId);

                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        return response;
                    } catch (err) {
                        const isLastAttempt = i === retries - 1;
                        if (isLastAttempt) throw err;

                        // Si falla, esperar y reintentar (útil si el servidor está despertando)
                        container.innerHTML = `<p class="loading-msg">⏳ Despertando servidor... (Intento ${i + 1}/${retries})</p>`;
                        console.log(`Reintentando conexión... (${i + 1})`);
                        await new Promise(res => setTimeout(res, delay));
                    }
                }
            };

            const response = await fetchWithRetry(window.Config.apiUrl('/api/cases'), 5, 3000); // 5 intentos, 3s espera
            casesData = await response.json();
            casesLoaded = true;

            // Guardar en localStorage como backup rápido
            localStorage.setItem('cached_cases_meta', JSON.stringify(casesData));

        } catch (e) {
            console.warn("No se pudo conectar al servidor. Usando caché local.", e);
            // Intentar cargar de backup local
            const cached = localStorage.getItem('cached_cases_meta');
            if (cached) {
                casesData = JSON.parse(cached);
                casesLoaded = true;
                // Mostrar aviso discreto
                alert("Modo Offline: Usando datos guardados localmente.");
            } else {
                container.innerHTML = `
                    <div class="error-container" style="text-align: center; padding: 20px;">
                        <p class="error-msg" style="color: #ff6b6b; margin-bottom: 10px;">⚠️ No se pudo conectar al servidor.</p>
                        <p style="font-size: 0.9rem; color: #ccc;">El servidor podría estar hibernando. Intenta de nuevo en unos segundos.</p>
                        <button onclick="loadCases()" class="btn-secondary" style="margin-top: 15px;">🔄 Reintentar</button>
                    </div>`;
                return;
            }
        }
    }

    container.innerHTML = '';

    // 2. Renderizar tarjetas
    for (const caseItem of casesData) {
        const card = document.createElement('div');
        card.className = 'case-card';

        // Verificar si está descargado (offline ready)
        const isOffline = await checkCaseOfflineStatus(caseItem);
        const statusIcon = isOffline ? '✅' : '☁️';
        const statusText = isOffline ? 'Listo para jugar' : 'Requiere descarga';

        const stars = generateStars(caseItem.difficulty);

        card.innerHTML = `
            <div class="case-header">
                <h3>${caseItem.title}</h3>
                <span class="status-icon" title="${statusText}">${statusIcon}</span>
            </div>
            <div class="case-difficulty">
                ${stars}
            </div>
            <p>Dificultad: ${caseItem.difficulty}/3</p>
            
            <div class="case-actions">
                <button class="play-btn">Jugar</button>
                ${!isOffline ? `<button class="download-btn" onclick="downloadCase(${caseItem.id}, this)">📥 Descargar</button>` : ''}
            </div>
        `;

        // Event listener para jugar
        card.querySelector('.play-btn').addEventListener('click', () => {
            if (isOffline || navigator.onLine) {
                showCase(caseItem.id);
            } else {
                alert("⚠️ Necesitas conexión a internet para jugar este caso por primera vez, o descárgalo antes.");
            }
        });

        container.appendChild(card);
    }
}

// Verificar si un caso tiene sus archivos en caché
async function checkCaseOfflineStatus(caseItem) {
    if (!('caches' in window)) return false;
    try {
        const cache = await caches.open('detective-cases-v1');
        // Verificamos si existe al menos el reporte policial inicial
        // Nota: Esto es una verificación rápida. Idealmente verificaríamos todos.
        const fileToCheck = `assets/casos/caso${caseItem.id}/${caseItem.documents.policial[0].file}`;
        const match = await cache.match(window.Config.apiUrl(fileToCheck));
        return !!match;
    } catch (e) {
        return false;
    }
}

// Descargar caso para uso offline
window.downloadCase = async (caseId, btn) => {
    btn.disabled = true;
    btn.textContent = "⏳ Descargando...";

    const caseItem = casesData.find(c => c.id === caseId);
    if (!caseItem) return;

    try {
        const cache = await caches.open('detective-cases-v1');
        const filesToCache = [];
        const baseUrl = window.Config.apiUrl(`assets/casos/caso${caseId}/`);

        // Recolectar todos los archivos PDF del caso
        // Documentos normales
        Object.values(caseItem.documents).forEach(group => {
            group.forEach(doc => filesToCache.push(baseUrl + doc.file));
        });
        // Solución
        Object.values(caseItem.solution).forEach(file => {
            filesToCache.push(baseUrl + file);
        });

        console.log(`Descargando ${filesToCache.length} archivos para el caso ${caseId}...`);

        // Añadir a caché
        await cache.addAll(filesToCache);

        btn.textContent = "✅ ¡Listo!";
        setTimeout(() => loadCases(), 1000); // Recargar UI

    } catch (e) {
        console.error("Error descargando caso:", e);
        btn.textContent = "❌ Error";
        btn.disabled = false;
        alert("Hubo un error al descargar. Verifica tu internet.");
    }
};

// Generar estrellas de dificultad
function generateStars(difficulty) {
    let stars = '';
    for (let i = 1; i <= 3; i++) {
        if (i <= difficulty) {
            stars += '<span class="star">★</span>';
        } else {
            stars += '<span class="star empty">★</span>';
        }
    }
    return stars;
}

// Gestión de pestañas
function showTab(tabName) {
    console.log('Mostrando pestaña:', tabName);
    currentTab = tabName;
    updateTabs();
    loadDocuments();
}

function updateTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === currentTab) {
            tab.classList.add('active');
        }
    });
}

// Cargar documentos según la pestaña activa
function loadDocuments() {
    if (!currentCase) return;

    const container = document.getElementById('documents-container');
    let documents = [];

    if (currentTab === 'finales') {
        // Cargar documentos finales desde solution
        if (currentCase.solution) {
            documents = Object.entries(currentCase.solution).map(([key, file]) => ({
                name: "FINAL - " + key.charAt(0).toUpperCase() + key.slice(1),
                file: file,
                isFinal: true
            }));
        }
    } else {
        documents = currentCase.documents[currentTab] || [];
    }

    if (documents.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #888;">No hay documentos disponibles en esta sección.</p>';
        return;
    }

    const list = document.createElement('div');
    list.className = 'document-list';

    documents.forEach(doc => {
        const item = document.createElement('div');
        item.className = 'document-item';
        // Si es final, usar estilo destacado
        if (doc.isFinal) item.style.border = "1px solid #f093fb";

        item.addEventListener('click', () => openDocument(doc.file, doc.name));

        item.innerHTML = `
            <span class="document-icon">${doc.isFinal ? '📂' : '📄'}</span>
            <span>${doc.name}</span>
        `;

        list.appendChild(item);
    });

    container.innerHTML = '';
    container.appendChild(list);
}

// Función para desbloquear y mostrar documentos finales (llamada desde evaluation.js)
function unlockFinalDocuments() {
    console.log('Desbloqueando archivos finales...');

    // 1. Mostrar la pestaña
    const tabBtn = document.getElementById('tab-finales');
    if (tabBtn) {
        tabBtn.style.display = 'block';
        tabBtn.classList.add('unlocked'); // Para animaciones CSS si se desea
    }

    // 2. Volver a pantalla del caso
    backToCase();

    // 3. Cambiar a la pestaña finales
    showTab('finales');
}

// Variables del visor PDF
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
const scale = 1.5;

// Configurar PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Abrir documento PDF
function openDocument(filename, docName) {
    const path = `assets/casos/caso${currentCase.id}/${filename}`;
    console.log('Abriendo PDF:', path);

    // Mostrar modal
    const modal = document.getElementById('pdf-modal');
    modal.classList.add('active');

    // Actualizar título
    document.getElementById('pdf-title').textContent = docName || 'Documento';

    // Cargar PDF
    loadPDF(path);
}

// Cargar PDF
function loadPDF(url) {
    const loadingTask = pdfjsLib.getDocument(url);

    loadingTask.promise.then(pdf => {
        pdfDoc = pdf;
        pageNum = 1;
        document.getElementById('pdf-page-info').textContent = `Página ${pageNum} de ${pdf.numPages}`;
        renderPage(pageNum);
    }).catch(error => {
        console.error('Error cargando PDF:', error);
        alert('Error al cargar el documento. Asegúrate de que el archivo PDF existe en la carpeta correcta.');
        closePDFModal();
    });
}

// Renderizar página
function renderPage(num) {
    pageRendering = true;

    pdfDoc.getPage(num).then(page => {
        const canvas = document.getElementById('pdf-canvas');
        const ctx = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: scale });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        const renderTask = page.render(renderContext);

        renderTask.promise.then(() => {
            pageRendering = false;
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });

    // Actualizar info de página
    document.getElementById('pdf-page-info').textContent = `Página ${num} de ${pdfDoc.numPages}`;

    // Actualizar botones
    document.getElementById('pdf-prev').disabled = (num <= 1);
    document.getElementById('pdf-next').disabled = (num >= pdfDoc.numPages);
}

// Página anterior
function prevPage() {
    if (pageNum <= 1) return;
    pageNum--;
    queueRenderPage(pageNum);
}

// Página siguiente
function nextPage() {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    queueRenderPage(pageNum);
}

// Cola de renderizado
function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

// Cerrar modal PDF
function closePDFModal() {
    const modal = document.getElementById('pdf-modal');
    modal.classList.remove('active');
    pdfDoc = null;
}

// Cargar solución del caso
function loadSolution() {
    if (!currentCase) return;

    const container = document.getElementById('solution-container');
    const solution = currentCase.solution;

    const list = document.createElement('div');
    list.innerHTML = '<h3 style="margin-bottom: 20px; color: #f093fb;">Documentos Finales</h3>';

    const docList = document.createElement('div');
    docList.className = 'document-list';

    Object.entries(solution).forEach(([key, file]) => {
        const item = document.createElement('div');
        item.className = 'document-item';
        item.addEventListener('click', () => openSolutionDocument(file));

        item.innerHTML = `
            <span class="document-icon">📄</span>
            <span>FINAL - ${key.charAt(0).toUpperCase() + key.slice(1)}</span>
        `;

        docList.appendChild(item);
    });

    container.innerHTML = '';
    container.appendChild(list);
    container.appendChild(docList);
}

// Abrir documento de solución
function openSolutionDocument(filename) {
    const path = `assets/casos/caso${currentCase.id}/${filename}`;

    alert(`Abriendo documento final: ${filename}\n\nRuta: ${path}\n\n(El visor de PDF se integrará en el siguiente paso)`);

    // TODO: Integrar visor de PDF
    // window.open(path, '_blank');
}

// Event Listeners
function initializeEventListeners() {
    console.log('Inicializando event listeners...');

    // Botón de inicio
    const startButton = document.getElementById('start-button');
    if (startButton) {
        startButton.addEventListener('click', showCaseSelection);
        console.log('Event listener añadido al botón Comenzar');
    }

    // Botón de ajustes
    const settingsButton = document.getElementById('settings-button');
    if (settingsButton) {
        settingsButton.addEventListener('click', showSettings);
    }

    // Botón Guardar Ajustes
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            const input = document.getElementById('server-url-input');
            const status = document.getElementById('settings-status');

            if (input) {
                window.Config.baseUrl = input.value;
                status.textContent = "✅ Configuración guardada. Reinicia la app si es necesario.";
                status.style.color = "#4ade80";

                // Reconectar si es posible
                if (window.multiplayerSystem) {
                    window.multiplayerSystem.roomId = null; // Reset simple
                    alert('Configuración guardada. Vuelve al inicio para conectar.');
                    showHome();
                }
            }
        });
    }

    // Botones de volver
    const backToHomeBtn = document.getElementById('back-to-home');
    if (backToHomeBtn) {
        backToHomeBtn.addEventListener('click', showHome);
    }

    const backToHomeFromSettings = document.getElementById('back-to-home-from-settings');
    if (backToHomeFromSettings) {
        backToHomeFromSettings.addEventListener('click', showHome);
    }

    const backToCasesBtn = document.getElementById('back-to-cases');
    if (backToCasesBtn) {
        backToCasesBtn.addEventListener('click', showCaseSelection);
    }

    const backToCaseBtn = document.getElementById('back-to-case');
    if (backToCaseBtn) {
        backToCaseBtn.addEventListener('click', backToCase);
    }

    // Botón resolver
    const solveButton = document.getElementById('solve-button');
    if (solveButton) {
        solveButton.addEventListener('click', showSolution);
    }

    // Pestañas
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => showTab(tab.dataset.tab));
    });

    // Controles del visor PDF
    const pdfCloseBtn = document.getElementById('pdf-close-btn');
    if (pdfCloseBtn) {
        pdfCloseBtn.addEventListener('click', closePDFModal);
    }

    const pdfPrevBtn = document.getElementById('pdf-prev');
    if (pdfPrevBtn) {
        pdfPrevBtn.addEventListener('click', prevPage);
    }

    const pdfNextBtn = document.getElementById('pdf-next');
    if (pdfNextBtn) {
        pdfNextBtn.addEventListener('click', nextPage);
    }
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado, iniciando aplicación...');
    initializeEventListeners();
    showHome();
});
