class MultiplayerSystem {
    constructor() {
        this.socket = null; // No usamos socket real, pero mantenemos nombre por semántica
        this.roomId = null;
        this.playerName = localStorage.getItem('player_name') || 'Detective_' + Math.floor(Math.random() * 1000);
        this.isHost = false;
        this.pollInterval = null;
        this.pollInterval = null;
        this.lastLocalUpdate = 0;
        this.lastSyncedCaseId = null; // Para prevenir bucles de sincronización
        this.lastVoteCount = 0;
        this.lastProcessedVoteJson = '';

        this.initElements();
        this.initEventListeners();

        // Verificar si viene de un QR (URL Params)
        const urlParams = new URLSearchParams(window.location.search);
        const roomFromUrl = urlParams.get('room');

        if (roomFromUrl) {
            console.log('Detectado código de sala desde URL:', roomFromUrl);
            this.roomCodeInput.value = roomFromUrl;
            // Pequeño delay para asegurar carga del DOM del modal si fuera necesario
            setTimeout(() => {
                this.openLobby();
                if (this.playerName && this.playerName.length > 2) {
                    this.joinRoom();
                }
            }, 500);
        }

        // Verificar si ya estaba conectado
        const savedRoom = sessionStorage.getItem('current_room');
        if (savedRoom) {
            this.roomId = savedRoom;
            this.startPolling();
            this.updateConnectionStatus(true);
        }
    }

    initElements() {
        // UI Elements
        this.multiplayerBtn = document.getElementById('multiplayer-btn');
        this.lobbyModal = document.getElementById('lobby-modal');
        this.lobbyCloseBtn = document.getElementById('lobby-close-btn');

        // Forms
        this.createRoomBtn = document.getElementById('create-room-btn');
        this.joinRoomBtn = document.getElementById('join-room-btn');
        this.roomCodeInput = document.getElementById('room-code-input');
        this.playerNameInput = document.getElementById('player-name-input');

        // Nuevo: Selector de casos y botón de inicio
        this.caseSelect = document.getElementById('lobby-case-select');
        this.startGameBtn = document.getElementById('start-game-btn');
        this.hostInfoDiv = document.getElementById('host-info');

        // Status display
        this.statusContainer = document.getElementById('connection-status');
        this.roomDisplay = document.getElementById('room-display');

        // Pre-fill name and ensure it's saved
        if (this.playerNameInput) {
            this.playerNameInput.value = this.playerName;
            localStorage.setItem('player_name', this.playerName); // Forzar guardado inicial
        }

        // Llenar selector de casos (si existe casesData global)
        if (this.caseSelect && typeof casesData !== 'undefined') {
            this.caseSelect.innerHTML = '';
            casesData.forEach(c => {
                const option = document.createElement('option');
                option.value = c.id;
                option.textContent = c.title;
                this.caseSelect.appendChild(option);
            });
        }
    }

    initEventListeners() {
        // Abrir lobby desde ajustes o menú principal
        if (this.multiplayerBtn) {
            this.multiplayerBtn.addEventListener('click', () => this.openLobby());
        }

        if (this.lobbyCloseBtn) {
            this.lobbyCloseBtn.addEventListener('click', () => {
                this.lobbyModal.classList.remove('active');
            });
        }

        if (this.createRoomBtn) {
            this.createRoomBtn.addEventListener('click', () => this.createRoom());
        }

        if (this.joinRoomBtn) {
            this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        }

        // Nuevo: Botón Iniciar Partida
        if (this.startGameBtn) {
            this.startGameBtn.addEventListener('click', () => this.startGame());
        }

        if (this.playerNameInput) {
            this.playerNameInput.addEventListener('change', (e) => {
                this.playerName = e.target.value;
                localStorage.setItem('player_name', this.playerName);
            });
        }
    }

    openLobby() {
        this.lobbyModal.classList.add('active');
        // Resetear vista
        if (this.hostInfoDiv) this.hostInfoDiv.style.display = 'none';
        if (this.createRoomBtn) this.createRoomBtn.style.display = 'block';
    }

    async createRoom() {
        // Guardar el caso seleccionado localmente
        this.selectedCaseId = this.caseSelect ? this.caseSelect.value : 1;

        try {
            const response = await fetch('/api/create-room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerName: this.playerName })
            });

            const data = await response.json();
            if (data.success) {
                this.roomId = data.roomId;
                this.isHost = true;
                this.onRoomConnected();
            }
        } catch (error) {
            console.error('Error creando sala:', error);
            alert('Error al conectar con el servidor');
        }
    }

    async joinRoom() {
        const code = this.roomCodeInput.value.toUpperCase().trim();
        if (!code) return alert('Ingresa un código de sala');

        try {
            const response = await fetch('/api/join-room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: code, playerName: this.playerName })
            });

            const data = await response.json();
            if (data.success) {
                this.roomId = code;
                this.isHost = false;

                // Cargar notas iniciales del servidor
                if (window.notesSystem && data.roomState.notes) {
                    window.notesSystem.notes = data.roomState.notes;
                    window.notesSystem.loadCurrentCategory();
                }

                // alert(`¡Unido a la sala ${this.roomId}!\nEsperando a que el anfitrión inicie la partida...`); // Eliminado
                this.onRoomConnected();
            } else {
                alert(data.error || 'No se pudo unir a la sala');
            }
        } catch (error) {
            console.error('Error uniéndose a sala:', error);
            alert('Error al conectar con el servidor');
        }
    }

    onRoomConnected() {
        sessionStorage.setItem('current_room', this.roomId);
        this.updateConnectionStatus(true);
        this.startPolling();

        if (this.isHost) {
            this.lobbyModal.classList.add('active');
            this.showHostInfo();
        } else {
            // Invitado: Mostrar pantalla de espera dentro del lobby
            this.lobbyModal.classList.add('active');
            this.showGuestWaiting();
        }
    }

    showGuestWaiting() {
        // Ocultar formularios de entrada
        const sections = this.lobbyModal.querySelectorAll('.lobby-section');
        sections.forEach(s => s.style.display = 'none');

        // Mostrar sección de espera (y asegurarnos que su padre sea visible si estaba oculto)
        // Como guest-waiting está dentro de .lobby-section en el HTML original modificado, 
        // necesitamos ocultar el contenido del section pero dejar el section visible o mover el div.
        // Corrección: El div guest-waiting lo puse DENTRO del div de crear. Vamos a moverlo o manejarlo mejor).

        // Simplificación: Ocultar todo lo que no sea guest-waiting
        if (this.createRoomBtn) this.createRoomBtn.parentElement.style.display = 'none'; // Oculta "Crear Nueva Investigación"
        if (this.roomCodeInput) this.roomCodeInput.closest('.lobby-section').style.display = 'none'; // Oculta "Unirse"

        // Mostrar el waiting div (que ahora podría estar huérfano si oculté el padre, ups. 
        // El guest-waiting lo puse DENTRO del div de crear. Vamos a moverlo o manejarlo mejor).

        const guestWaiting = document.getElementById('guest-waiting');
        if (guestWaiting) {
            // Lo movemos al body del lobby para que no dependa de las secciones ocultas
            const lobbyBody = this.lobbyModal.querySelector('.lobby-body');
            lobbyBody.appendChild(guestWaiting);

            guestWaiting.style.display = 'block';
            const codeDisplay = document.getElementById('guest-room-code');
            if (codeDisplay) codeDisplay.textContent = this.roomId;
        }
    }

    // Nuevo: Iniciar partida (Host)
    startGame() {
        if (!this.isHost) return;

        console.log('Iniciando partida con caso:', this.selectedCaseId);

        // 1. Navegar localmente
        if (typeof showCase === 'function') {
            showCase(Number(this.selectedCaseId));
        }

        // 2. Forzar envío de mis notas locales al servidor
        // para que todos empiecen con mi información
        setTimeout(() => {
            if (window.notesSystem) {
                console.log('Enviando notas iniciales del anfitrión...');
                window.notesSystem.saveCurrentNote();
            }
        }, 500);

        // 3. Enviar señal al servidor para cambiar activeCaseId
        // Lo hacemos después para asegurar que las notas ya estén (casi) listas
        // o al menos que el flujo sea lógico.
        this.sendActiveCaseUpdate(this.selectedCaseId);

        this.lobbyModal.classList.remove('active');
    }

    async showHostInfo() {
        const roomCodeDisplay = document.getElementById('room-code-display');
        const qrContainer = document.getElementById('qrcode');

        if (this.hostInfoDiv && roomCodeDisplay && qrContainer) {
            this.hostInfoDiv.style.display = 'block';
            roomCodeDisplay.textContent = this.roomId;

            // Ocultar botón de crear
            if (this.createRoomBtn) this.createRoomBtn.style.display = 'none';

            // Mostrar botón de iniciar
            if (this.startGameBtn) this.startGameBtn.style.display = 'block';

            // Obtener IP local para el QR
            try {
                const res = await fetch('/api/network-info');
                const netInfo = await res.json();

                // URL: http://IP:PORT/?room=CODE
                const joinUrl = `http://${netInfo.ip}:${netInfo.port}/?room=${this.roomId}`;

                qrContainer.innerHTML = '';
                new QRCode(qrContainer, {
                    text: joinUrl,
                    width: 128,
                    height: 128
                });

            } catch (e) {
                console.error('Error generando QR', e);
            }
        }
    }

    updateConnectionStatus(connected) {
        if (!this.statusContainer) return;

        if (connected) {
            this.statusContainer.style.display = 'flex';
            this.roomDisplay.textContent = `Sala: ${this.roomId}`;
        } else {
            this.statusContainer.style.display = 'none';
        }
    }

    startPolling() {
        if (this.pollInterval) clearInterval(this.pollInterval);

        // Polling cada 2 segundos
        this.pollInterval = setInterval(() => this.pollState(), 2000);
    }

    async pollState() {
        if (!this.roomId) return;

        try {
            const response = await fetch(`/api/room/${this.roomId}`);
            const state = await response.json();

            if (state.error) {
                console.error('Error de servidor:', state.error);

                // Si la sala no existe (reinicio de servidor), desconectar al cliente
                if (state.error === 'Sala no encontrada') {
                    this.disconnect('La sala ha sido cerrada por el servidor.');
                }
                return;
            }

            // 1. Sincronizar Caso Activo
            const serverCaseId = String(state.activeCaseId);
            const currentCaseId = window.currentCase ? String(window.currentCase.id) : null;

            // Verificar si realmente necesitamos cambiar de caso
            // Condición: Hay un caso en el servidor Y (es diferente al actual O no tenemos caso actual)
            if (state.activeCaseId && (currentCaseId !== serverCaseId)) {

                // Evitar re-sincronizar si ya lo hicimos recientemente para este mismo ID
                if (this.lastSyncedCaseId === serverCaseId) {
                    // Ya hemos intentado sincronizar este caso. 
                    // Si window.currentCase sigue siendo null/distinto, puede que la navegación fallara o esté en proceso.
                    // Pero para evitar bucles, no insistimos inmediatamente.
                    // We still want to process notes, so don't return the whole pollState.
                } else {
                    console.log(`🔍 Sincronizando caso: Local=${currentCaseId} -> Server=${serverCaseId}`);
                    this.lastSyncedCaseId = serverCaseId; // Marcar como sincronizado

                    // Cerrar modal si está abierto (Invitado saliendo de espera)
                    if (this.lobbyModal.classList.contains('active')) {
                        this.lobbyModal.classList.remove('active');
                    }

                    // Navegar
                    if (typeof showCase === 'function') {
                        showCase(Number(state.activeCaseId));
                    }
                }
            }

            // 2. Sincronizar Notas
            const notesSystem = window.notesSystem;
            const isTyping = notesSystem && document.activeElement === notesSystem.textarea;

            if (state.lastUpdate > this.lastLocalUpdate) {
                if (!isTyping) {
                    console.log('Recibiendo actualización de notas del servidor...');
                    this.lastLocalUpdate = state.lastUpdate;

                    if (notesSystem) {
                        notesSystem.updateNotesFromExternal(state.notes);
                    }
                } else {
                    console.log('Update disponible, pero usuario escribiendo. Pospuesto.');
                }
            }

            // 3. Verificar estado de votación
            this.checkVotingStatus(state);

        } catch (error) {
            console.error('Polling error:', error);
        }
    }

    // Llamado por notes.js cuando el usuario guarda cambios
    async sendNotesUpdate(notes) {
        if (!this.roomId) return;

        try {
            await fetch('/api/update-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: this.roomId,
                    notes: notes,
                    playerName: this.playerName
                })
            });
            this.lastLocalUpdate = Date.now();
        } catch (error) {
            console.error('Network update error:', error);
        }
    }

    // Llamado por app.js cuando el host entra a un caso
    async sendActiveCaseUpdate(caseId) {
        if (!this.roomId || !this.isHost) return;

        try {
            await fetch('/api/set-active-case', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: this.roomId,
                    caseId: caseId
                })
            });
        } catch (error) {
            console.error('Error actualizando caso activo:', error);
        }
    }
    async submitVote(voteData) {
        console.log('submitVote llamado con:', voteData);
        if (!this.roomId) {
            console.error('Intento de voto sin RoomID');
            return;
        }

        // Mostrar estado de espera
        this.showVotingWaitScreen();

        try {
            await fetch('/api/submit-vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: this.roomId,
                    playerName: this.playerName,
                    voteData: voteData
                })
            });
            console.log('Voto enviado al servidor');
        } catch (error) {
            console.error('Error enviando voto:', error);
            alert('Error al enviar votación');
        }
    }

    showVotingWaitScreen() {
        // Cerrar modal de resolución si está abierto
        if (window.evaluationSystem) {
            window.evaluationSystem.resolutionModal.classList.remove('active');
        }

        // Reutilizar lobby modal o crear uno nuevo simple para feedback
        // Por simplicidad, usaremos un alert/overlay custom o el mismo lobby
        this.lobbyModal.classList.add('active');

        // Limpiar contenido y mostrar estado
        const lobbyBody = this.lobbyModal.querySelector('.lobby-body');
        lobbyBody.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <h2 style="color: #f093fb; margin-bottom: 20px;">🗳️ Deliberando...</h2>
                <div class="loader" style="margin: 0 auto 20px;"></div>
                <p id="voting-status-text" style="color: #fff;">Esperando votos del resto del equipo...</p>
            </div>
        `;
    }

    checkVotingStatus(state) {
        if (!state.votes) return;

        const totalVotes = Object.keys(state.votes).length;
        const totalPlayers = state.players.length;

        // Detectar reset de votación (si teníamos votos y ahora son 0)
        if (this.lastVoteCount > 0 && totalVotes === 0) {
            console.log('Votación reiniciada por el servidor');
            if (this.lobbyModal.classList.contains('active')) {
                // Cambiar mensaje antes de cerrar
                const statusText = document.getElementById('voting-status-text');
                if (statusText) statusText.textContent = "Reiniciando...";

                setTimeout(() => {
                    this.lobbyModal.classList.remove('active');
                }, 1000);
            }
            this.lastProcessedVoteJson = ''; // Resetear hash
        }
        this.lastVoteCount = totalVotes;

        // Actualizar UI de espera
        const statusText = document.getElementById('voting-status-text');
        if (statusText && this.lobbyModal.classList.contains('active')) {
            if (totalVotes < totalPlayers) {
                statusText.textContent = `Votos recibidos: ${totalVotes} / ${totalPlayers}`;
            }
        }

        // Si todos han votado, calcular consenso
        if (totalVotes > 0 && totalVotes >= totalPlayers) {
            // Generar hash simple de los votos para no procesar lo mismo 2 veces
            const currentVoteJson = JSON.stringify(state.votes);

            if (this.lastProcessedVoteJson !== currentVoteJson) {
                this.lastProcessedVoteJson = currentVoteJson;
                this.calculateConsensus(state.votes, totalPlayers);
            }
        }
    }

    calculateConsensus(votes, totalPlayers) {
        console.log('--- Calculando Consenso ---');
        console.log(`Jugadores Totales: ${totalPlayers}`);
        console.log('Votos Recibidos:', JSON.stringify(votes, null, 2));

        const voteList = Object.values(votes);
        if (voteList.length === 0) return;

        // Extraer respuestas (Normalizamos strings)
        const culprits = voteList.map(v => v.culprit ? v.culprit.trim() : "");

        console.log('Lista de Culpables (Normalizada):', culprits);

        // Función para encontrar modo (elemento más común)
        // Versión Robusta: No muta el array original
        const getMode = (arr) => {
            if (arr.length === 0) return null;
            const counts = {};
            arr.forEach(val => counts[val] = (counts[val] || 0) + 1);

            // Convertir a pares [val, count] y ordenar por count descendente
            const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            return entries[0][0]; // Retorna el valor más frecuente
        };

        const winnerCulprit = getMode(culprits);
        const culpritVotes = culprits.filter(c => c === winnerCulprit).length;

        console.log(`Ganador Identificado: "${winnerCulprit}" con ${culpritVotes} votos.`);

        let consensusReached = false;

        if (totalPlayers < 3) {
            // Unanimidad Estricta
            // Todos los jugadores deben haber votado por el mismo
            consensusReached = (culpritVotes === totalPlayers);
            console.log(`Regla < 3 (Unanimidad): ${culpritVotes} === ${totalPlayers} ? ${consensusReached}`);
        } else {
            // Mayoría
            const counts = {};
            culprits.forEach(c => counts[c] = (counts[c] || 0) + 1);
            const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);

            // Verificar empate en el primer puesto
            if (sortedCounts.length > 1 && sortedCounts[0][1] === sortedCounts[1][1]) {
                consensusReached = false; // Empate
                console.log('Regla >= 3 (Mayoría): Empate detectado en cabeza.');
            } else {
                consensusReached = true;
                console.log('Regla >= 3 (Mayoría): Consenso alcanzado (Mayoría simple).');
            }
        }


        if (consensusReached) {
            this.lobbyModal.classList.remove('active');
            if (window.evaluationSystem) {
                alert('¡Veredicto Alcanzado!');
                window.evaluationSystem.evaluateConsensus(voteList);
            }
        } else {
            // CONFLICTO
            const statusText = document.getElementById('voting-status-text');
            if (statusText) {
                statusText.innerHTML = `<span style="color: #ff5252; font-weight: bold; font-size: 1.2rem;">¡Desacuerdo!</span><br><br>No hay consenso en el veredicto.<br>Debatan de nuevo.`;
            }

            // Si soy host, inicio cuenta atrás para limpiar votos
            if (this.isHost) {
                setTimeout(() => {
                    this.resetVotes();
                }, 4000); // 4 segundos para leer el mensaje
            }
        }
    }

    async resetVotes() {
        if (!this.roomId) return;
        try {
            await fetch('/api/reset-votes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: this.roomId })
            });
        } catch (error) {
            console.error('Error reseteando votos:', error);
        }
    }

    disconnect(reason = 'Desconectado') {
        console.log('Desconectando:', reason);

        // Limpiar estado
        this.roomId = null;
        this.isHost = false;
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.lastSyncedCaseId = null;

        // Limpiar almacenamiento
        sessionStorage.removeItem('current_room');

        // Limpiar UI
        this.updateConnectionStatus(false);
        this.lobbyModal.classList.remove('active');

        // Avisar al usuario (opcional, para no ser invasivo si es solo una recarga rápida)
        // Usamos un toast o alerta suave si es posible, por ahora alert standard para seguridad
        alert(reason);

        // Volver a pantalla de inicio si estábamos jugando
        window.location.reload(); // La forma más limpia de resetear todo el estado de la app
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.multiplayerSystem = new MultiplayerSystem();
});
