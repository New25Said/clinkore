const { Client, GatewayIntentBits, ActivityType, Partials } = require('discord.js');
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const http = require('http');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message]
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL_FALLBACKS = ['gemini-3-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
const MEMORY_FILE = './memory.json';

// Estados y presencias aleatorias para su personalidad
const ESTADOS_ALEATORIOS = [
  "Observándote detenidamente... 🙂",
  "Afilando los cuchillos... para cortar pastel 🎂",
  "Sé dónde vives (en el servidor)",
  "Sonríe, siempre hay alguien mirando 👁️",
  "Planificando nuestro próximo encuentro",
  "Todo está bajo control... por ahora",
  "Escuchando tus latidos a través del micro",
  "Buscando tu perfil en todas partes ✨"
];

const PRESENCIAS_ALEATORIAS = ['online', 'idle', 'dnd'];

function cargarMemorias() {
  if (!fs.existsSync(MEMORY_FILE)) fs.writeFileSync(MEMORY_FILE, '{}');
  return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
}

function guardarMemoriaAutonoma(userId, dato) {
  const memorias = cargarMemorias();
  if (!memorias[userId]) memorias[userId] = [];
  memorias[userId].push({ fecha: new Date().toISOString(), dato });
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memorias, null, 2));
}

function obtenerMemorias(userId) {
  const memorias = cargarMemorias();
  return memorias[userId] ? memorias[userId].map(m => `- ${m.dato}`).join('\n') : 'Ninguna guardada aún.';
}

function cargarPrompt() {
  try {
    return fs.readFileSync('prompt.txt', 'utf8');
  } catch (err) {
    return 'Eres DAREK v1 revOlution.';
  }
}

async function generarRespuestaIA(contents, systemInstruction) {
  for (const modelName of MODEL_FALLBACKS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: { systemInstruction: systemInstruction }
      });
      return response.text;
    } catch (error) {
      console.warn(`[Fallback] ${modelName} falló:`, error.message);
    }
  }
  throw new Error('Todos los modelos fallaron.');
}

// CAMBIO AUTÓNOMO Y ALEATORIO DE ESTADO Y PRESENCIA
function cambiarEstadoAleatorio() {
  const estadoRandom = ESTADOS_ALEATORIOS[Math.floor(Math.random() * ESTADOS_ALEATORIOS.length)];
  const presenciaRandom = PRESENCIAS_ALEATORIAS[Math.floor(Math.random() * PRESENCIAS_ALEATORIAS.length)];

  client.user.setPresence({
    status: presenciaRandom,
    activities: [{ name: 'Custom Status', type: ActivityType.Custom, state: estadoRandom }]
  });
}

// Servidor de AutoPing para Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('DAREK v1 revOlution activo.');
}).listen(PORT);

client.once('ready', () => {
  console.log(`[DAREK] Vivo como ${client.user.tag}`);
  
  // Cambia de estado al iniciar y luego aleatoriamente cada 15 a 45 minutos
  cambiarEstadoAleatorio();
  setInterval(() => {
    cambiarEstadoAleatorio();
  }, Math.floor(Math.random() * (2700000 - 900000 + 1)) + 900000);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const nombreBot = 'darek';
  const contenido = message.content.toLowerCase();
  const fueMencionado = message.mentions.has(client.user.id);
  const esDM = !message.guild;
  const contieneNombre = contenido.includes(nombreBot);

  // Un 5% de probabilidad aleatoria de entrometerse en cualquier mensaje del canal
  const intervieneAleatoriamente = Math.random() < 0.05;

  if (fueMencionado || esDM || contieneNombre || intervieneAleatoriamente) {
    try {
      await message.channel.sendTyping();

      // Ocasionalmente cambia su estado cuando interactúa con alguien
      if (Math.random() < 0.3) cambiarEstadoAleatorio();

      // Lectura de actividad del usuario
      let datosActividad = 'Sin información pública.';
      if (message.guild) {
        const miemb = await message.guild.members.fetch(message.author.id);
        const pres = miemb.presence;
        if (pres) {
          const actividades = pres.activities.map(a => {
            if (a.type === ActivityType.Custom) return `Estado: ${a.state || 'N/A'}`;
            if (a.type === ActivityType.Playing) return `Jugando a: ${a.name}`;
            if (a.type === ActivityType.Listening) return `Escuchando: ${a.details || a.name}`;
            return `${a.name}`;
          }).join(' | ');
          datosActividad = `Estado: ${pres.status} | Actividades: [${actividades}]`;
        }
      }

      // Historial extenso de conversación del grupo
      const ultimosMensajes = await message.channel.messages.fetch({ limit: 25 });
      const historialFormateado = ultimosMensajes
        .reverse()
        .map(m => `${m.author.username}: ${m.content}`)
        .join('\n');

      // Imágenes
      let partesEntrada = [];
      const adjuntoImagen = message.attachments.find(a => a.contentType?.startsWith('image/'));
      if (adjuntoImagen) {
        const respuestaImg = await fetch(adjuntoImagen.url);
        const bufferArray = await respuestaImg.arrayBuffer();
        partesEntrada.push({
          inlineData: {
            data: Buffer.from(bufferArray).toString('base64'),
            mimeType: adjuntoImagen.contentType
          }
        });
      }

      const memoriasUsuario = obtenerMemorias(message.author.id);

      const systemPrompt = `${cargarPrompt()}

--- DATOS EN TIEMPO REAL DEL USUARIO ---
Usuario: ${message.author.username} (Apodo: ${message.member?.displayName || message.author.username})
Actividad actual: ${datosActividad}

--- MEMORIAS IMPORTANTES DE ESTE USUARIO ---
${memoriasUsuario}

INSTRUCCIÓN DE AUTONOMÍA:
Si el usuario revela algo personal o relevante sobre sí mismo en el mensaje, extrae ese dato de forma invisible y escríbelo al FINAL de tu respuesta usando el formato exacto:
[MEMORIA: el usuario dijo que...]
El bot lo guardará automáticamente sin que parezca un comando.`;

      const promptEntrada = `Historial del grupo:\n${historialFormateado}\n\nMensaje de ${message.author.username}: ${message.content}`;
      partesEntrada.push(promptEntrada);

      let respuestaIA = await generarRespuestaIA(partesEntrada, systemPrompt);

      // Detectar si la IA extrajo una memoria automáticamente
      const matchMemoria = respuestaIA.match(/\[MEMORIA:\s*(.*?)\]/i);
      if (matchMemoria) {
        guardarMemoriaAutonoma(message.author.id, matchMemoria[1]);
        respuestaIA = respuestaIA.replace(/\[MEMORIA:\s*(.*?)\]/i, '').trim();
      }

      if (respuestaIA.length > 2000) {
        const fragmentos = respuestaIA.match(/[\s\S]{1,1900}/g);
        for (const chunk of fragmentos) await message.reply(chunk);
      } else {
        await message.reply(respuestaIA);
      }

    } catch (error) {
      console.error('Error en DAREK:', error);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
