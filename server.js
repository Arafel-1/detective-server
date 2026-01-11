const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 8000;

// Estado del juego en memoria
const rooms = new Map();

// Utilidades
const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const getMimeType = (ext) => {
    const types = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.json': 'application/json'
    };
    return types[ext] || 'application/octet-stream';
};

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // API ENDPOINTS
    if (req.url.startsWith('/api/')) {
        handleApi(req, res);
        return;
    }

    // SERVIR ARCHIVOS ESTÁTICOS
    // Primero, separamos la URL base de los parámetros (query string)
    const urlParts = new URL(req.url, `http://${req.headers.host}`);
    let filePath = '.' + urlParts.pathname;

    // Si es raíz, servir index.html
    if (filePath === './') filePath = './index.html';

    // Evitar salir del directorio
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');

    const extname = String(path.extname(safePath)).toLowerCase();
    const contentType = getMimeType(extname);

    fs.readFile(safePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end('500 Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Manejador de API
function handleApi(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Helper para enviar JSON
    const sendJson = (data, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };

    // Helper para leer body
    const readBody = (callback) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                callback(JSON.parse(body || '{}'));
            } catch (e) {
                sendJson({ error: 'Invalid JSON' }, 400);
            }
        });
    };

    // 1. CREAR SALA (POST /api/create-room)
    if (url.pathname === '/api/create-room' && req.method === 'POST') {
        readBody((data) => {
            const roomId = generateRoomId();
            const playerName = data.playerName || 'Detective';

            rooms.set(roomId, {
                id: roomId,
                host: playerName,
                players: [{ name: playerName, lastSeen: Date.now() }],
                notes: {
                    sospechosos: {},
                    pistas: {},
                    teorias: {},
                    cronologia: {},
                    general: {}
                },
                votes: {}, // { playerName: { culprit, motive, method, evidence } }
                votingStatus: 'open', // 'open', 'completed'
                activeCaseId: null, // Caso activo en la sala
                lastUpdate: Date.now()
            });

            console.log(`Sala creada: ${roomId} por ${playerName}`);
            sendJson({ roomId, success: true });
        });
        return;
    }

    // 2. UNIRSE A SALA (POST /api/join-room)
    if (url.pathname === '/api/join-room' && req.method === 'POST') {
        readBody((data) => {
            const { roomId, playerName } = data;
            const room = rooms.get(roomId);

            if (!room) {
                return sendJson({ error: 'Sala no encontrada' }, 404);
            }

            // Añadir jugador si no existe
            const existingPlayer = room.players.find(p => p.name === playerName);
            if (!existingPlayer) {
                room.players.push({ name: playerName, lastSeen: Date.now() });
            } else {
                existingPlayer.lastSeen = Date.now();
            }

            console.log(`Jugador ${playerName} se unió a ${roomId}`);
            sendJson({ success: true, roomState: room });
        });
        return;
    }

    // 3. OBTENER ESTADO (GET /api/room/:roomId)
    if (url.pathname.startsWith('/api/room/') && req.method === 'GET') {
        const roomId = url.pathname.split('/')[3];
        const room = rooms.get(roomId);

        if (!room) return sendJson({ error: 'Sala no encontrada' }, 404);

        sendJson(room);
        return;
    }

    // 4. ACTUALIZAR NOTAS (POST /api/update-notes)
    if (url.pathname === '/api/update-notes' && req.method === 'POST') {
        readBody((data) => {
            const { roomId, notes, playerName } = data;
            const room = rooms.get(roomId);

            if (!room) return sendJson({ error: 'Sala no encontrada' }, 404);

            // Actualizar notas
            room.notes = notes;
            room.lastUpdate = Date.now();

            // Actualizar "lastSeen" del jugador
            const player = room.players.find(p => p.name === playerName);
            if (player) player.lastSeen = Date.now();

            sendJson({ success: true });
        });
        return;
    }

    // 4.5. CAMBIAR CASO ACTIVO (POST /api/set-active-case)
    if (url.pathname === '/api/set-active-case' && req.method === 'POST') {
        readBody((data) => {
            const { roomId, caseId } = data;
            const room = rooms.get(roomId);

            if (!room) return sendJson({ error: 'Sala no encontrada' }, 404);

            room.activeCaseId = caseId;
            room.lastUpdate = Date.now();
            console.log(`Sala ${roomId} cambió al caso ${caseId}`);
            sendJson({ success: true });
        });
        return;
    }

    // 4.6. ENVIAR VOTO (POST /api/submit-vote)
    if (url.pathname === '/api/submit-vote' && req.method === 'POST') {
        readBody((data) => {
            const { roomId, playerName, voteData } = data;
            const room = rooms.get(roomId);

            if (!room) return sendJson({ error: 'Sala no encontrada' }, 404);

            // Guardar voto
            room.votes[playerName] = voteData;
            room.lastUpdate = Date.now();

            // Verificar si todos han votado
            const totalPlayers = room.players.length;
            const totalVotes = Object.keys(room.votes).length;

            console.log(`Voto recibido en ${roomId} de ${playerName} (${totalVotes}/${totalPlayers})`);

            sendJson({ success: true, totalVotes, totalPlayers });
        });
        return;
    }

    // 4.7. RESETEAR VOTOS (POST /api/reset-votes)
    if (url.pathname === '/api/reset-votes' && req.method === 'POST') {
        readBody((data) => {
            const { roomId } = data;
            const room = rooms.get(roomId);

            if (!room) return sendJson({ error: 'Sala no encontrada' }, 404);

            room.votes = {};
            room.lastUpdate = Date.now();

            console.log(`Votos reseteados en sala ${roomId}`);
            sendJson({ success: true });
        });
        return;
    }

    // 5. OBTENER CONFIGURACIÓN DE RED (GET /api/network-info)
    if (url.pathname === '/api/network-info' && req.method === 'GET') {
        const networkInfo = getNetworkInfo();
        sendJson(networkInfo);
        return;
    }

    sendJson({ error: 'Endpoint not found' }, 404);
}

// Obtener IP local
function getNetworkInfo() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    const results = {};

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Saltamos direcciones internas (no-ipv4 o localhost)
            if (net.family === 'IPv4' && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }

    // Preferir WiFi o Ethernet
    let ip = 'localhost';
    const allIps = Object.values(results).flat();
    if (allIps.length > 0) {
        ip = allIps[0]; // Tomamos la primera IP válida encontrada
    }

    return { ip, port: PORT };
}

// Limpieza de salas inactivas (cada 30 min)
setInterval(() => {
    const now = Date.now();
    for (const [id, room] of rooms.entries()) {
        if (now - room.lastUpdate > 3600000) { // 1 hora
            rooms.delete(id);
            console.log(`Sala ${id} eliminada por inactividad`);
        }
    }
}, 1800000);

// Iniciar servidor
// Render asigna un puerto dinámico en la variable process.env.PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('  Enigma Files Server (Multijugador)');
    console.log('========================================');
    console.log(`Servidor de Juego de Detectives corriendo en puerto ${PORT}`);
    // Note: 'ip' is not defined in this scope. Assuming it's a global or imported variable.
    // If 'ip' is meant to be from getNetworkInfo, it needs to be handled differently.
    // For now, keeping the instruction as is.
    console.log(`Dirección local: http://${ip.address()}:${PORT}`);
    console.log('========================================');
});
