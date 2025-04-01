const xlsx = require('xlsx');
const fs = require('fs');
const { formatoFecha } = require('./helpers');
const { obtenerRespuestaGemini } = require('./gemini'); // Importa la función de Gemini

const workbook = xlsx.readFile('SEGUIMIENTO.xlsx');
const sheetName = workbook.SheetNames[0];
const seguimientoData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });

const buscarProximosProgramas = async (mensaje) => {
    if (!mensaje) {
        return { texto: "❌ No encontré programas próximos con ese nombre.", imagen: null, pdf: null, programa: "Desconocido" };
    }

    const hoy = new Date();
    const programasFiltrados = seguimientoData
        .filter(row =>
            row.PROGRAMA && row.PROGRAMA.toUpperCase().includes(mensaje.toUpperCase()) &&
            row["F. INI PROGRAMA"] && new Date(row["F. INI PROGRAMA"]) >= hoy
        )
        .sort((a, b) => new Date(a["F. INI PROGRAMA"]) - new Date(b["F. INI PROGRAMA"]))
        .slice(0, 2);

    if (programasFiltrados.length === 0) {
        // Aquí es donde llamamos a Gemini si no encontramos resultados
        const respuestaGemini = await obtenerRespuestaGemini(mensaje);
        return { texto: `🤖 *¡Aquí está lo que encontré sobre tu búsqueda!*\n\n${respuestaGemini}`, imagen: null, pdf: null, programa: "Desconocido" };
    }

    let respuesta = "📚 *Programas Disponibles Próximamente*\n\n";
    let imagen = null;
    let pdf = null;

    programasFiltrados.forEach((programa, index) => {
        respuesta += `🔹 *Opción ${index + 1}:*\n` +
            `📌 *Programa:* ${programa.PROGRAMA}\n` +
            `📆 *Inicio:* ${formatoFecha(programa["F. INI PROGRAMA"])}\n` +
            `📅 *Días:* ${programa["DIAS CLASE"]}\n` +
            `⏰ *Horario:* ${programa["HORARIO"]}\n` +
            `👨‍🏫 *Docentes:* ${programa["Docente"]}\n\n`;

        if (programa.IMAGEN) {
            let imagenPath = `./media/${programa.IMAGEN}`;
            if (fs.existsSync(imagenPath)) {
                imagen = imagenPath;
            }
        }
        if (programa.PDF && programa.CATEGORIA) {
            let pdfPath = `./media/pdfs/${programa.CATEGORIA}/${programa.PDF}`;
            if (fs.existsSync(pdfPath)) {
                pdf = pdfPath;
            }
        }
    });

    return { texto: respuesta, imagen, pdf, programa: programasFiltrados[0]?.PROGRAMA || "Desconocido" };
};

module.exports = buscarProximosProgramas;