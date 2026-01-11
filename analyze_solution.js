const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

// Archivos a analizar
const filesToAnalyze = [
    '../casos/caso 1 Silencio en el apartamento 804/elementos del juego/resolucion final.pdf',
    '../casos/caso 1 Silencio en el apartamento 804/declaraciones/FINAL DECLARACIONES.pdf',
    '../casos/caso 1 Silencio en el apartamento 804/pistas y pruebas/FINAL DOCUMENTOS.pdf'
];

async function analyzeFiles() {
    console.log('Iniciando análisis de archivos confidenciales...');
    let outputContent = 'ANALISIS DE SOLUCION CONFIDENCIAL\n================================\n';

    for (const relativePath of filesToAnalyze) {
        const fullPath = path.join(__dirname, relativePath);
        console.log(`Leyendo: ${relativePath}`);

        if (fs.existsSync(fullPath)) {
            try {
                const dataBuffer = fs.readFileSync(fullPath);
                const data = await pdf(dataBuffer);
                outputContent += `\n\n----------------------------------------\nARCHIVO: ${path.basename(fullPath)}\n----------------------------------------\n`;
                outputContent += data.text;
            } catch (error) {
                console.error(`Error leyendo ${path.basename(fullPath)}:`, error.message);
                outputContent += `\nERROR LEYENDO ARHIVO: ${error.message}\n`;
            }
        } else {
            console.warn(`Archivo no encontrado: ${fullPath}`);
            outputContent += `\nARCHIVO NO ENCONTRADO: ${relativePath}\n`;
        }
    }

    fs.writeFileSync('secret_solution.txt', outputContent);
    console.log('\nAnálisis completado. El contenido se guardó en "secret_solution.txt".');
    console.log('NO ABRAS este archivo si no quieres spoilers.');
}

analyzeFiles();
