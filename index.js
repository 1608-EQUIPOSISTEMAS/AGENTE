const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const xlsx = require('xlsx');
const fs = require('fs');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

const seguimientoPath = 'SEGUIMIENTO.xlsx';
const historialPath = 'HISTORIAL.xlsx';
const seguimientoWorkbook = xlsx.readFile(seguimientoPath);
const seguimientoSheet = seguimientoWorkbook.SheetNames[0];
const seguimientoData = xlsx.utils.sheet_to_json(seguimientoWorkbook.Sheets[seguimientoSheet], { raw: false });

let historialWorkbook, historialSheet, historialData;
if (fs.existsSync(historialPath)) {
    historialWorkbook = xlsx.readFile(historialPath);
    historialSheet = historialWorkbook.SheetNames.includes("HISTORIAL") ? "HISTORIAL" : historialWorkbook.SheetNames[0];
    historialData = xlsx.utils.sheet_to_json(historialWorkbook.Sheets[historialSheet], { raw: false });
} else {
    historialWorkbook = xlsx.utils.book_new();
    historialSheet = "HISTORIAL";
    historialData = [];
    xlsx.utils.book_append_sheet(historialWorkbook, xlsx.utils.json_to_sheet(historialData), historialSheet);
    xlsx.writeFile(historialWorkbook, historialPath);
}

const formatoFecha = (valor) => {
    if (!valor) return "Fecha no disponible";
    let date = new Date(valor);
    if (isNaN(date.getTime())) return "Fecha inválida";
    return `${date.getDate().toString().padStart(2, '0')}/` + 
           `${(date.getMonth() + 1).toString().padStart(2, '0')}/` + 
           `${date.getFullYear()}`;
};

// Función para detectar saludo
const detectarSaludo = (mensaje) => {
    const saludos = ['hola', 'buenas', 'buenos días', 'buenas tardes', 'buenas noches'];
    return saludos.some(saludo => mensaje.toLowerCase().includes(saludo));
};

const buscarProximosProgramas = (mensaje) => {
    if (!mensaje || typeof mensaje !== 'string') {
        return { texto: "❌ No encontré programas próximos con ese nombre.", imagen: null, pdf: null, programa: "Desconocido" };
    }
    
    const hoy = new Date();
    const programasFiltrados = seguimientoData
        .filter(row => 
            row.PROGRAMA && typeof row.PROGRAMA === 'string' &&
            row.PROGRAMA.toUpperCase().includes(mensaje.toUpperCase()) &&
            row["F. INI PROGRAMA"] && new Date(row["F. INI PROGRAMA"]) >= hoy
        )
        .sort((a, b) => new Date(a["F. INI PROGRAMA"]) - new Date(b["F. INI PROGRAMA"]))
        .slice(0, 2);

    if (programasFiltrados.length === 0) {
        return { texto: "❌ No encontré programas próximos con ese nombre.", imagen: null, pdf: null, programa: "Desconocido" };
    }

    let respuesta = "📚 *Programas Disponibles Próximamente*\n\n";
    let imagen = null;
    let pdf = null;

    programasFiltrados.forEach((programa, index) => {
        
        respuesta += `🔹 *Opción ${index + 1}:*\n` +
        `📌 *Programa:* ${programa.PROGRAMA}\n` +
        `📆 *Inicio:* ${formatoFecha(programa["F. INI PROGRAMA"])}` +
        `\n📅 *Días:* ${programa["DIAS CLASE"]}\n` +
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

const guardarConsulta = (numero, mensaje, programa) => {
    const index = historialData.findIndex(entry => entry.Numero === numero);
    if (index === -1) {
        historialData.push({ Numero: numero, Mensaje: mensaje, Programa: programa });
    } else {
        historialData[index].Programa = programa;
    }
    const worksheet = xlsx.utils.json_to_sheet(historialData);
    historialWorkbook.Sheets[historialSheet] = worksheet;
    xlsx.writeFile(historialWorkbook, historialPath);
};

client.on('qr', (qr) => {
    console.log('Escanea este QR con WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot de WhatsApp está listo para usar.');
});

client.on('message', async (message) => {
    try {
        if (message.from.includes('@g.us') || message.from.includes('@broadcast')) return;
        if (message.type !== 'chat') return;

        console.log(`📩 Nuevo mensaje de ${message.from}:`, message.body);

        const mensaje = message.body.toLowerCase().trim();

        // Detectar saludo
        if (detectarSaludo(mensaje)) {
            await message.reply("👋 ¡Hola! Soy tu asistente virtual. ¿Cómo puedo ayudarte hoy?");
            return;
        }

        const resultado = buscarProximosProgramas(message.body);
        console.log("🔍 Resultado de la búsqueda:", resultado);

        guardarConsulta(message.from, message.body, resultado.programa);

        await message.reply("👋 ¡Hola! Soy tu asistente virtual. Aquí tienes la información:");
        await message.reply(resultado.texto);
        if (resultado.imagen) {
            const mediaImagen = MessageMedia.fromFilePath(resultado.imagen);
            await client.sendMessage(message.from, mediaImagen);
        }
        if (resultado.pdf) {
            const mediaPdf = MessageMedia.fromFilePath(resultado.pdf);
            await client.sendMessage(message.from, mediaPdf);
        }
    } catch (error) {
        console.error('❌ Error en el manejo del mensaje:', error.message);
    }
});

client.initialize();
