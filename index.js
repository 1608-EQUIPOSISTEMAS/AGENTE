const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const xlsx = require('xlsx');
const fs = require('fs');

// 🔹 Configurar el cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

// 🔹 Cargar datos desde el archivo Excel
const workbook = xlsx.readFile('SEGUIMIENTO.xlsx');
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });

// 🔹 Función para convertir fechas correctamente en formato DÍA/MES/AÑO
const formatoFecha = (valor) => {
    if (!valor) return "Fecha no disponible";
    let date = new Date(valor);
    if (isNaN(date.getTime())) return "Fecha inválida";
    return `${date.getDate().toString().padStart(2, '0')}/` + 
           `${(date.getMonth() + 1).toString().padStart(2, '0')}/` + 
           `${date.getFullYear()}`;
};

// 🔹 Función para buscar programas y archivos multimedia asociados
const buscarProximosProgramas = (mensaje) => {
    const hoy = new Date();

    // 📌 Filtrar programas por nombre y fecha
    const programasFiltrados = data
        .filter(row => 
            row.PROGRAMA.toLowerCase().includes(mensaje.toLowerCase()) &&
            row["F. INI PROGRAMA"] && new Date(row["F. INI PROGRAMA"]) >= hoy
        )
        .sort((a, b) => new Date(a["F. INI PROGRAMA"]) - new Date(b["F. INI PROGRAMA"]))
        .slice(0, 2);

    if (programasFiltrados.length === 0) {
        return { texto: "❌ No encontré programas próximos con ese nombre.", imagen: null, pdf: null };
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

        // 📂 Verificar si el programa tiene una imagen asociada
        if (programa.IMAGEN) {
            let imagenPath = `./media/${programa.IMAGEN}`;
            if (fs.existsSync(imagenPath)) {
                imagen = imagenPath;
            }
        }

        // 📂 Verificar si el programa tiene un PDF asociado
        if (programa.PDF) {
            let pdfPath = `./media/${programa.PDF}`;
            if (fs.existsSync(pdfPath)) {
                pdf = pdfPath;
            }
        }
    });

    return { texto: respuesta, imagen, pdf };
};

// 🔹 Escanear el código QR en la terminal
client.on('qr', (qr) => {
    console.log('Escanea este QR con WhatsApp:');
    qrcode.generate(qr, { small: true });
});

// 🔹 Confirmar que el bot está listo
client.on('ready', () => {
    console.log('✅ Bot de WhatsApp está listo para usar.');
});

// 🔹 Manejar los mensajes entrantes
client.on('message', async (message) => {
    try {
        // 🛑 Omitir mensajes de grupos y canales
        if (message.from.includes('@g.us') || message.from.includes('@broadcast')) {
            console.log(`⏩ Mensaje omitido (grupo/canal): ${message.body}`);
            return;
        }

        // 🛑 Omitir mensajes que NO sean de texto
        if (message.type !== 'chat') {
            console.log(`⏩ Mensaje omitido (no es texto): ${message.type}`);
            return;
        }

        console.log(`📩 Nuevo mensaje de ${message.from}: ${message.body}`);

        // 🔍 Buscar información y archivos multimedia
        const resultado = buscarProximosProgramas(message.body);

        // 📨 Enviar mensaje con información del programa
        await message.reply(resultado.texto);

        // 📷 Enviar imagen si existe
        if (resultado.imagen) {
            const mediaImagen = MessageMedia.fromFilePath(resultado.imagen);
            await client.sendMessage(message.from, mediaImagen);
        }

        // 📄 Enviar PDF si existe
        if (resultado.pdf) {
            const mediaPdf = MessageMedia.fromFilePath(resultado.pdf);
            await client.sendMessage(message.from, mediaPdf);
        }

    } catch (error) {
        console.error('❌ Error en el manejo del mensaje:', error.message);
    }
});

// 🔹 Iniciar el cliente de WhatsApp
client.initialize();
