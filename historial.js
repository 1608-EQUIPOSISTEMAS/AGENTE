const xlsx = require('xlsx');
const fs = require('fs');

const historialPath = 'HISTORIAL.xlsx';
const historialSheet = 'CONVERSACIONES';

let workbookHistorial, historial;

// Cargar o crear el archivo HISTORIAL.xlsx
if (fs.existsSync(historialPath)) {
    workbookHistorial = xlsx.readFile(historialPath);
    historial = workbookHistorial.Sheets[historialSheet] 
        ? xlsx.utils.sheet_to_json(workbookHistorial.Sheets[historialSheet]) 
        : [];
} else {
    workbookHistorial = xlsx.utils.book_new();
    historial = [];
    const worksheet = xlsx.utils.json_to_sheet(historial);
    xlsx.utils.book_append_sheet(workbookHistorial, worksheet, historialSheet);
    xlsx.writeFile(workbookHistorial, historialPath);
}

/**
 * Guarda la consulta en el historial, asegurando que solo se guarde la primera vez
 * @param {string} numero - Número de WhatsApp del usuario
 * @param {string} mensaje - Mensaje que envió el usuario
 * @param {string} programa - Programa detectado en la consulta
 */
const guardarConsulta = (numero, mensaje, programa) => {
    const existe = historial.find(entry => entry.Numero === numero);
    
    if (!existe) {
        // Si es la primera vez, guardamos el número, mensaje y programa
        historial.push({ Numero: numero, Mensaje: mensaje, Programa: programa });
    } else if (existe.Programa !== programa) {
        // Si el usuario consulta otro programa, actualizamos el registro
        existe.Programa = programa;
    } else {
        return; // No hacemos nada si el programa ya está registrado
    }

    // Guardar los cambios en el archivo
    const nuevoSheet = xlsx.utils.json_to_sheet(historial);
    workbookHistorial.Sheets[historialSheet] = nuevoSheet;
    xlsx.writeFile(workbookHistorial, historialPath);
};

module.exports = { guardarConsulta };
