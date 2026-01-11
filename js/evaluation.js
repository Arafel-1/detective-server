class EvaluationSystem {
    constructor() {
        this.caseData = null;
        this.initElements();
        this.initEventListeners();
    }

    initElements() {
        this.resolutionModal = document.getElementById('resolution-modal');
        this.resultsModal = document.getElementById('results-modal');
        this.resolutionForm = document.getElementById('resolution-form');
        this.closeResolutionBtn = document.getElementById('resolution-close-btn');

        // Form elements
        this.culpritSelect = document.getElementById('culprit-select');
        this.motiveInput = document.getElementById('motive-input');
        this.methodContainer = document.getElementById('method-options');
        this.evidenceContainer = document.getElementById('evidence-options');
    }

    initEventListeners() {
        if (this.closeResolutionBtn) {
            this.closeResolutionBtn.addEventListener('click', () => {
                this.resolutionModal.classList.remove('active');
            });
        }

        if (this.resolutionForm) {
            this.resolutionForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.evaluateCase();
            });
        }
    }

    // Datos del caso (CONFIGURACIÓN DE SOLUCIÓN)
    // ADVERTENCIA DE SPOILERS: Aquí se define la solución correcta
    loadCaseData(caseId) {
        // CONFIGURACIÓN DEL CASO REAL: Silencio en el Apartamento 804
        this.caseConfig = {
            options: {
                suspects: [
                    "Laura Benítez (Administradora)",
                    "Roberto Silva (Socio)",
                    "Elena Vargas (Vecina)",
                    "Javier Méndez (Conserje)",
                    "Lucía Torres (Amiga)"
                ],
                methods: [
                    "Golpe contundente (Traumatismo)",
                    "Envenenamiento",
                    "Disparo con arma de fuego",
                    "Apuñalamiento",
                    "Estrangulamiento"
                ],
                evidence: [
                    "Informe Forense (Signos de lucha/golpe)",
                    "Registro de Accesos (Hora crítica)",
                    "Documentos Financieros (Desfalco)",
                    "Audios de WhatsApp (Amenazas)",
                    "Mensajes de Texto (Discusión)",
                    "Declaración de Laura (Contradicciones)",
                    "Declaración del Conserje",
                    "Huellas en la escena"
                ]
            },
            solution: {
                culprit: "Laura Benítez (Administradora)",
                motiveKeywords: ["fraude", "fondos", "dinero", "robo", "auditoría", "desvío", "administrativ", "financiero"],
                method: "Golpe contundente (Traumatismo)",
                keyEvidence: [1, 2, 0] // Registro de Accesos, Documentos Financieros, Informe Forense
            }
        };

        this.populateForm();
    }

    populateForm() {
        // Llenar sospechosos
        this.culpritSelect.innerHTML = '<option value="">Selecciona un sospechoso...</option>';
        this.caseConfig.options.suspects.forEach(suspect => {
            const option = document.createElement('option');
            option.value = suspect;
            option.textContent = suspect;
            this.culpritSelect.appendChild(option);
        });

        // Llenar métodos
        this.methodContainer.innerHTML = '';
        this.caseConfig.options.methods.forEach(method => {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            div.innerHTML = `
                <input type="radio" name="method" value="${method}" required>
                <label>${method}</label>
            `;
            this.methodContainer.appendChild(div);
        });

        // Llenar evidencias
        this.evidenceContainer.innerHTML = '';
        this.caseConfig.options.evidence.forEach((ev, index) => {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            div.innerHTML = `
                <input type="checkbox" name="evidence" value="${index}">
                <label>${ev}</label>
            `;
            this.evidenceContainer.appendChild(div);
        });
    }

    openResolution() {
        this.loadCaseData(currentCase.id);
        this.resolutionModal.classList.add('active');
    }

    evaluateCase() {
        console.log('Iniciando evaluación del caso...');
        const solution = this.caseConfig.solution;
        let score = 0;
        let breakdown = {
            culprit: 0,
            motive: 0,
            method: 0,
            evidence: 0
        };

        // Recopilar datos del formulario
        const selectedCulprit = this.culpritSelect.value;
        // Validación de nulidad para evitar crash
        const motiveText = this.motiveInput.value ? this.motiveInput.value.toLowerCase() : "";
        const selectedMethod = document.querySelector('input[name="method"]:checked')?.value;
        const selectedEvidence = Array.from(document.querySelectorAll('input[name="evidence"]:checked'))
            .map(cb => parseInt(cb.value));

        console.log('Datos recogidos:', { selectedCulprit, motiveText, selectedMethod, selectedEvidence });

        // MODO MULTIJUGADOR: Enviar voto en lugar de evaluar localmente
        if (window.multiplayerSystem && window.multiplayerSystem.roomId) {
            console.log('Detectado modo multijugador. Sala:', window.multiplayerSystem.roomId);
            const voteData = {
                culprit: selectedCulprit,
                motive: motiveText,
                method: selectedMethod,
                evidence: selectedEvidence
            };

            // Verificar si submitVote existe
            if (typeof window.multiplayerSystem.submitVote === 'function') {
                window.multiplayerSystem.submitVote(voteData);
            } else {
                console.error('Error crítico: submitVote no es una función');
                alert('Error del sistema: No se puede enviar el voto. Revisa la consola.');
            }
            return; // Detener evaluación local
        } else {
            console.log('Modo local (Sin sala activa)');
        }

        // 1. Evaluar Culpable (40 pts)
        if (selectedCulprit === solution.culprit) {
            score += 40;
            breakdown.culprit = 40;
        }

        // 2. Evaluar Motivo (20 pts)
        // Análisis simple de palabras clave
        const motiveHits = solution.motiveKeywords.filter(word => motiveText.includes(word)).length;
        if (motiveHits >= 1) {
            score += 20;
            breakdown.motive = 20;
        } else if (motiveHits > 0) {
            score += 10; // Parcial
            breakdown.motive = 10;
        }

        // 3. Evaluar Método (20 pts)
        if (selectedMethod === solution.method) {
            score += 20;
            breakdown.method = 20;
        }

        // 4. Evaluar Evidencias (20 pts total)
        let correctEvidence = 0;
        selectedEvidence.forEach(index => {
            if (solution.keyEvidence.includes(index)) {
                correctEvidence++;
            } else {
                correctEvidence -= 0.5; // Penalización leve por evidencia incorrecta
            }
        });

        const evidenceScore = Math.max(0, Math.min(20, Math.round((correctEvidence / solution.keyEvidence.length) * 20)));
        score += evidenceScore;
        breakdown.evidence = evidenceScore;

        this.showResults(score, breakdown);
    }

    showResults(score, breakdown) {
        this.resolutionModal.classList.remove('active');
        this.resultsModal.classList.add('active');

        // Actualizar UI de resultados
        document.getElementById('final-score').textContent = Math.round(score);

        // Rango
        const rankData = this.getRank(score);
        document.getElementById('rank-badge').textContent = rankData.badge;
        document.getElementById('rank-title').textContent = rankData.title;

        // Desglose
        this.updateBreakdown('res-culprit', breakdown.culprit, 40);
        this.updateBreakdown('res-motive', breakdown.motive, 20);
        this.updateBreakdown('res-method', breakdown.method, 20);
        this.updateBreakdown('res-evidence', breakdown.evidence, 20);
    }

    updateBreakdown(id, value, max) {
        const el = document.getElementById(id).querySelector('.score-value');
        el.textContent = `+${Math.round(value)}/${max}`;
        if (value === 0) el.className = 'score-value zero';
        else el.className = 'score-value';
    }

    getRank(score) {
        if (score >= 90) return { badge: '🏆', title: 'Detective Maestro' };
        if (score >= 70) return { badge: '⭐', title: 'Detective Experto' };
        if (score >= 50) return { badge: '👍', title: 'Detective Competente' };
        if (score >= 30) return { badge: '📚', title: 'Aprendiz' };
        return { badge: '🔍', title: 'Novato' };
    }
    evaluateConsensus(voteList) {
        // Función auxiliar para mayoría
        const getMode = (arr) => {
            return arr.sort((a, b) =>
                arr.filter(v => v === a).length
                - arr.filter(v => v === b).length
            ).pop();
        };

        // Construir "Respuesta del Grupo"
        const finalVote = {
            culprit: getMode(voteList.map(v => v.culprit)),
            motive: getMode(voteList.map(v => v.motive)),
            method: getMode(voteList.map(v => v.method)),
            evidence: []
        };

        // Para evidencias (array), aplanamos y contamos frecuencia
        const allEvidence = voteList.flatMap(v => v.evidence);
        const evidenceCounts = {};
        allEvidence.forEach(e => evidenceCounts[e] = (evidenceCounts[e] || 0) + 1);

        // Seleccionamos las que tengan >= 50% de apoyo
        const threshold = Math.ceil(voteList.length / 2);
        finalVote.evidence = Object.keys(evidenceCounts)
            .filter(k => evidenceCounts[k] >= threshold)
            .map(Number);

        // Calcular Score (Reutilizando lógica interna)
        const solution = this.caseConfig.solution;
        let score = 0;
        let breakdown = { culprit: 0, motive: 0, method: 0, evidence: 0 };

        // 1. Culpable
        if (finalVote.culprit === solution.culprit) { score += 40; breakdown.culprit = 40; }

        // 2. Motivo
        const motiveHits = solution.motiveKeywords.filter(word => finalVote.motive.includes(word)).length;
        if (motiveHits >= 1) { score += 20; breakdown.motive = 20; }
        else if (motiveHits > 0) { score += 10; breakdown.motive = 10; }

        // 3. Método
        if (finalVote.method === solution.method) { score += 20; breakdown.method = 20; }

        // 4. Evidencias
        let correctEvidence = 0;
        finalVote.evidence.forEach(index => {
            if (solution.keyEvidence.includes(index)) correctEvidence++;
            else correctEvidence -= 0.5;
        });
        const evidenceScore = Math.max(0, Math.min(20, Math.round((correctEvidence / solution.keyEvidence.length) * 20)));
        score += evidenceScore;
        breakdown.evidence = evidenceScore;

        this.showResults(score, breakdown);
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.evaluationSystem = new EvaluationSystem();
});

// Funciones globales auxiliares
function closeResults() {
    document.getElementById('results-modal').classList.remove('active');
}

function showSolutionDocuments() {
    closeResults();
    // Llamar a la nueva lógica en app.js para desbloquear pestaña
    if (window.unlockFinalDocuments) {
        window.unlockFinalDocuments();
    } else {
        console.error("Función unlockFinalDocuments no encontrada en app.js");
    }
}
