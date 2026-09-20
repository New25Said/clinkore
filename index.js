const { Client, GatewayIntentBits, ActivityType, Partials } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_FALLBACKS = [
  // --- NIVEL LITE (Latencia ultra-baja y alta escala) ---
  'gemini-2.5-flash-lite', // El más barato del ecosistema ($0.10/M tokens)
  'gemini-3.1-flash-lite', // Versión Lite inicial de la generación 3
  'gemini-3.5-flash-lite', // El modelo Lite más avanzado y rápido

  // --- NIVEL FLASH (Equilibrio perfecto velocidad/capacidad) ---
  'gemini-2.5-flash',      // El balance clásico y muy estable
  'gemini-3.5-flash',      // Estándar multitarea con mejor procesamiento
  'gemini-3.6-flash',      // Iteración optimizada para ejecución rápida
  'gemini-3.7-flash',      // Líder en generación de código y flujos autónomos
  'gemini-3.8-flash',      // El modelo Flash más moderno, rápido y capaz (Septiembre 2026)

  // --- NIVEL PRO / DEEP THINK (Máximo razonamiento) ---
  'gemini-2.5-pro',        // Pensamiento adaptativo estable para tareas complejas
  'gemini-3.1-pro'         // La inteligencia frontera definitiva para código pesado
];

const MEMORY_FILE = './memory.json';

// Estados y presencias aleatorias
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
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
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
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction
      });

      const result = await model.generateContent(contents);
      return result.response.text();
    } catch (error) {
      console.warn(`[Fallback] ${modelName} falló:`, error.message);
    }
  }
  throw new Error('Todos los modelos fallaron.');
}

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
}).listen(PORT, () => {
  console.log(`[AutoPing] Servidor escuchando en puerto ${PORT}`);
});

client.once('ready', () => {
  console.log(`[DAREK] Vivo como ${client.user.tag}`);

  cambiarEstadoAleatorio();
  // Cambia de estado aleatoriamente cada 15 a 45 minutos
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

  // 5% de probabilidad aleatoria de intervenir espontáneamente en cualquier chat
  const intervieneAleatoriamente = Math.random() < 0.05;

  if (fueMencionado || esDM || contieneNombre || intervieneAleatoriamente) {
    try {
      await message.channel.sendTyping();

      if (Math.random() < 0.3) cambiarEstadoAleatorio();

      let datosActividad = 'Sin información pública.';
      if (message.guild) {
        try {
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
        } catch (e) {
          datosActividad = 'No se pudo leer la presencia.';
        }
      }

      const ultimosMensajes = await message.channel.messages.fetch({ limit: 25 });
      const historialFormateado = Array.from(ultimosMensajes.values())
        .reverse()
        .map(m => `${m.author.username}: ${m.content}`)
        .join('\n');

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
