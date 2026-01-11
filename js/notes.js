class NotesSystem {
    constructor() {
        this.currentCategory = 'sospechosos';
        this.currentCaseId = null;
        this.playerName = localStorage.getItem('player_name') || 'Detective';

        // Estructura nueva: { categoria: { "Jugador": "Texto" } }
        this.notes = this.getEmptyNotes();
        this.autosaveTimer = null;
        this.lastSaveTime = 0;

        this.initElements();
        this.initEventListeners();

        // Ocultar botón inicialmente
        if (this.toggleBtn) this.toggleBtn.style.display = 'none';
    }

    getEmptyNotes() {
        return {
            sospechosos: {},
            pistas: {},
            teorias: {},
            cronologia: {},
            general: {}
        };
    }

    setCaseId(caseId) {
        this.currentCaseId = caseId;
        this.notes = this.loadNotes();
        this.renderCurrentCategory();

        if (this.toggleBtn) {
            this.toggleBtn.style.display = 'block';
            this.toggleBtn.style.animation = 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        }
    }

    hide() {
        this.currentCaseId = null;
        if (this.toggleBtn) this.toggleBtn.style.display = 'none';
        this.panel.classList.remove('active');
    }

    initElements() {
        this.panel = document.getElementById('notes-panel');
        this.toggleBtn = document.getElementById('notes-toggle-btn');
        this.closeBtn = document.getElementById('notes-close-btn');
        this.contentArea = document.getElementById('notes-content-area'); // CONTENEDOR NUEVO
        this.clearBtn = document.getElementById('notes-clear-btn');
        this.autosaveIndicator = document.querySelector('.notes-autosave');
        this.tabs = document.querySelectorAll('.notes-tab');
    }

    initEventListeners() {
        if (!this.toggleBtn) {
            console.error('Error: Botón de notas no encontrado en el DOM');
            return;
        }

        // Abrir/Cerrar panel
        this.toggleBtn.addEventListener('click', () => {
            this.togglePanel();
        });

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.togglePanel());
        }

        // Cambiar categoría
        this.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                this.switchCategory(category);
            });
        });

        // Limpiar notas (Solo las mías)
        this.clearBtn.addEventListener('click', () => {
            if (confirm('¿Borrar tus notas de esta sección?')) {
                // Solo borrar mi entrada
                if (!this.notes[this.currentCategory]) this.notes[this.currentCategory] = {};
                this.notes[this.currentCategory][this.playerName] = '';

                this.renderCurrentCategory();
                this.saveCurrentNote();
            }
        });

        // Delegación de eventos para el input (ya que se crea dinámicamente)
        if (this.contentArea) {
            this.contentArea.addEventListener('input', (e) => {
                if (e.target.tagName === 'TEXTAREA' && !e.target.readOnly) {
                    this.handleInput(e.target);
                }
            });
        }
    }

    handleInput(textarea) {
        this.showSavingStatus();
        clearTimeout(this.autosaveTimer);
        this.autosaveTimer = setTimeout(() => this.saveCurrentNote(), 1000);
    }

    togglePanel() {
        this.panel.classList.toggle('active');
    }

    switchCategory(category) {
        // Guardar antes de cambiar
        this.saveCurrentNote();

        this.currentCategory = category;
        this.tabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.category === category) {
                tab.classList.add('active');
            }
        });

        this.renderCurrentCategory();
    }

    loadNotes() {
        if (!this.currentCaseId) return this.getEmptyNotes();

        const storageKey = `enigma_notes_case_${this.currentCaseId}`;
        const saved = localStorage.getItem(storageKey);
        let parsed = saved ? JSON.parse(saved) : this.getEmptyNotes();

        // Compatibilidad: Si es formato antiguo (strings), convertir
        if (typeof parsed.sospechosos === 'string') {
            console.log('Migrando notas antiguas...');
            const migrated = this.getEmptyNotes();
            Object.keys(parsed).forEach(cat => {
                migrated[cat] = { [this.playerName]: parsed[cat] || '' };
            });
            return migrated;
        }

        return parsed;
    }

    saveCurrentNote() {
        if (!this.currentCaseId) return;

        // Capturar valor actual del textarea (si existe y está renderizado)
        const myTextarea = document.getElementById(`note-input-${this.playerName.replace(/\s+/g, '_')}`);
        if (myTextarea) {
            if (!this.notes[this.currentCategory]) this.notes[this.currentCategory] = {};
            this.notes[this.currentCategory][this.playerName] = myTextarea.value;
        }

        this.lastSaveTime = Date.now();
        const storageKey = `enigma_notes_case_${this.currentCaseId}`;
        localStorage.setItem(storageKey, JSON.stringify(this.notes));

        this.showSavedStatus();

        if (window.multiplayerSystem && window.multiplayerSystem.roomId) {
            window.multiplayerSystem.sendNotesUpdate(this.notes);
        }
    }

    updateNotesFromExternal(remoteNotes) {
        // FUSIÓN INTELIGENTE:
        // Mantener mis notas locales (por si estoy escribiendo), adoptar las notas de otros.

        const myName = this.playerName;

        // 1. Clonar notas remotas
        const mergedNotes = JSON.parse(JSON.stringify(remoteNotes));

        // 2. Restaurar o preservar MIS notas locales actuales
        if (!mergedNotes[this.currentCategory]) mergedNotes[this.currentCategory] = {};

        // Si tengo notas locales, usarlas como fuente de verdad para MI parte
        if (this.notes[this.currentCategory] && this.notes[this.currentCategory][myName] !== undefined) {
            mergedNotes[this.currentCategory][myName] = this.notes[this.currentCategory][myName];
        }

        this.notes = mergedNotes;
        this.renderCurrentCategory();
        this.showExternalUpdateStatus();
    }

    showExternalUpdateStatus() {
        this.autosaveIndicator.textContent = '🔄 Recibiendo datos...';
        this.autosaveIndicator.style.color = '#60a5fa';
        setTimeout(() => {
            this.autosaveIndicator.textContent = 'Sincronizado';
            this.autosaveIndicator.style.color = '#4ade80';
        }, 1000);
    }

    renderCurrentCategory() {
        if (!this.contentArea) return;

        const categoryData = this.notes[this.currentCategory] || {};
        this.contentArea.innerHTML = '';

        // 1. Mostrar MI bloque primero (Editable)
        const myText = categoryData[this.playerName] || '';
        const myBlock = this.createNoteBlock(this.playerName, myText, true);
        this.contentArea.appendChild(myBlock);

        // 2. Mostrar bloques de OTROS (Solo lectura)
        Object.entries(categoryData).forEach(([player, text]) => {
            if (player !== this.playerName && text.trim().length > 0) {
                const otherBlock = this.createNoteBlock(player, text, false);
                this.contentArea.appendChild(otherBlock);
            }
        });
    }

    createNoteBlock(player, text, isEditable) {
        const wrapper = document.createElement('div');
        wrapper.className = `note-block ${isEditable ? 'mine' : 'other'}`;
        wrapper.style.marginBottom = '15px';

        const header = document.createElement('div');
        header.className = 'note-header';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.marginBottom = '5px';
        header.style.fontSize = '0.9rem';
        header.style.color = isEditable ? '#f093fb' : '#4ade80';
        header.innerHTML = `<strong>${isEditable ? 'Tu Libreta' : '🕵️ ' + player}</strong>`;

        const textarea = document.createElement('textarea');
        textarea.className = 'notes-textarea';
        textarea.value = text;
        textarea.readOnly = !isEditable;

        if (isEditable) {
            textarea.id = `note-input-${player.replace(/\s+/g, '_')}`;
            textarea.placeholder = "Escribe tus observaciones aquí...";
        } else {
            textarea.style.backgroundColor = 'rgba(0,0,0,0.2)';
            textarea.style.border = '1px dashed rgba(255,255,255,0.1)';
            textarea.style.color = '#ccc';
        }

        wrapper.appendChild(header);
        wrapper.appendChild(textarea);

        return wrapper;
    }

    loadCurrentCategory() {
        // Alias para compatibilidad con código antiguo
        this.renderCurrentCategory();
    }

    showSavingStatus() {
        this.autosaveIndicator.textContent = 'Guardando...';
        this.autosaveIndicator.style.color = '#ffd700'; // Dorado
    }

    showSavedStatus() {
        this.autosaveIndicator.textContent = 'Guardado';
        this.autosaveIndicator.style.color = '#4ade80'; // Verde
        setTimeout(() => {
            // Limpiar texto solo si no cambió
        }, 2000);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando Sistema de Notas...');
    window.notesSystem = new NotesSystem();
});
