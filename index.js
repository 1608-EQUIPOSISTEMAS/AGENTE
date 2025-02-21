const express = require('express');
const path = require('path');
const fs = require('fs');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const xlsx = require('xlsx');

// 🔹 Configurar el servidor Express
const app = express();
const PORT = process.env.PORT || 10000;

// 📂 Crear la carpeta `public/` si no existe
if (!fs.existsSync('./public')) {
    fs.mkdirSync('./public', { recursive: true });
}

// 📌 Servir archivos estáticos desde la carpeta `public`
app.use('/public', express.static(path.join(__dirname, 'public')));

// 🔹 Ruta para ver el QR en el navegador
app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'qrcode.png'));
});

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

// 🔹 Función para formatear fechas correctamente
const formatoFecha = (valor) => {
    if (!valor) return "Fecha no disponible";
    let date = new Date(valor);
    if (isNaN(date.getTime())) return "Fecha inválida";
    return `${date.getDate().toString().padStart(2, '0')}/` + 
           `${(date.getMonth() + 1).toString().padStart(2, '0')}/` + 
           `${date.getFullYear()}`;
};

// 🔹 Función para buscar programas y archivos multimedia
const buscarProximosProgramas = (mensaje) => {
    const hoy = new Date();
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

        // 📂 Verificar si hay imagen asociada
        if (programa.IMAGEN) {
            let imagenPath = `./media/${programa.IMAGEN}`;
            if (fs.existsSync(imagenPath)) {
                imagen = imagenPath;
            }
        }

        // 📂 Verificar si hay PDF asociado
        if (programa.PDF) {
            let pdfPath = `./media/${programa.PDF}`;
            if (fs.existsSync(pdfPath)) {
                pdf = pdfPath;
            }
        }
    });

    return { texto: respuesta, imagen, pdf };
};

// 🔹 Manejo del código QR
client.on('qr', async (qr) => {
    console.log('✅ QR generado. Accede a él en tu navegador.');

    try {
        await qrcode.toFile('./public/qrcode.png', qr);
    } catch (error) {
        console.error("❌ Error al generar el QR:", error.message);
    }
});


// 🔹 Confirmar que el bot está listo
client.on('ready', () => {
    console.log('✅ Bot de WhatsApp está listo para usar.');
});

// 🔹 Manejar los mensajes entrantes
client.on('message', async (message) => {
    
    try {
        if (message.from.includes('@g.us') || message.from.includes('@broadcast')) {
            console.log(`⏩ Mensaje omitido (grupo/canal): ${message.body}`);
            return;
        }

        if (message.type !== 'chat') {
            console.log(`⏩ Mensaje omitido (no es texto): ${message.type}`);
            return;
        }

        console.log(`📩 Nuevo mensaje de ${message.from}: ${message.body}`);

        const resultado = buscarProximosProgramas(message.body);

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

// 🔹 Iniciar el cliente de WhatsApp
client.initialize();

// 🔹 Iniciar el servidor Express
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
