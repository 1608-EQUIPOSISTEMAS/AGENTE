const axios = require('axios');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateText?key=${GEMINI_API_KEY}`;

const obtenerRespuestaGemini = async (mensaje) => {
    try {
        const response = await axios.post(GEMINI_URL, {
            prompt: {
                text: `Responde de manera amable a este mensaje de un usuario interesado en educación: "${mensaje}"`,
            }
        });

        return response.data?.candidates?.[0]?.output || "Lo siento, no encontré información sobre eso.";
    } catch (error) {
        console.error("❌ Error al consultar Gemini:", error.message);
        return "Lo siento, no pude obtener información en este momento.";
    }
};

module.exports = { obtenerRespuestaGemini };