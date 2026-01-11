const Config = {
    // Clave para localStorage
    STORAGE_KEY: 'detective_api_url',

    // URL por defecto (cadena vacía = relativa al origen actual, útil para web normal)
    // Para APK/Móvil se debe cambiar manualmente.
    defaultUrl: '',

    get baseUrl() {
        return localStorage.getItem(this.STORAGE_KEY) || this.defaultUrl;
    },

    set baseUrl(url) {
        // Normalizar: quitar slash final si existe
        let cleanUrl = url.trim();
        if (cleanUrl.endsWith('/')) {
            cleanUrl = cleanUrl.slice(0, -1);
        }
        localStorage.setItem(this.STORAGE_KEY, cleanUrl);
    },

    reset() {
        localStorage.removeItem(this.STORAGE_KEY);
    },

    // Helper para construir URLs completas
    apiUrl(endpoint) {
        // Asegurar que el endpoint empiece con /
        const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        return `${this.baseUrl}${path}`;
    }
};

// Exponer globalmente
window.Config = Config;
