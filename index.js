const { Client, GatewayIntentBits, ActivityType, Partials } = require('discord.js');
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const http = require('http');
require('dotenv').config();

// Inicializar cliente con los INTENTS necesarios para leer actividad y mensajes
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,     // Permite leer actividades, juegos y música
    GatewayIntentBits.GuildMembers,       // Permite leer nicks y perfiles
    GatewayIntentBits.MessageContent,     // Permite leer el contenido de los mensajes
    GatewayIntentBits.DirectMessages      // Permite responder en Mensajes Directos (MD)
  ],
  partials: [Partials.Channel, Partials.Message]
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Lista de modelos ordenados desde el principal hasta los fallbacks gratis
const MODEL_FALLBACKS = ['gemini-3-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];

// Archivo de almacenamiento de memorias
const MEMORY_FILE = './memory.json';

function cargarMemorias() {
  if (!fs.existsSync(MEMORY_FILE)) fs.writeFileSync(MEMORY_FILE, '{}');
  return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
}

function guardarMemoria(userId, dato) {
  const memorias = cargarMemorias();
  if (!memorias[userId]) memorias[userId] = [];
  memorias[userId].push({ fecha: new Date().toISOString(), dato });
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memorias, null, 2));
}

function obtenerMemorias(userId) {
  const memorias = cargarMemorias();
  return memorias[userId] ? memorias[userId].map(m => `- ${m.dato}`).join('\n') : 'Ninguna registrada.';
}

function cargarPrompt() {
  try {
    return fs.readFileSync('prompt.txt', 'utf8');
  } catch (err) {
    return 'Eres DAREK v1 revOlution, un bot avanzado de IA.';
  }
}

// Función con Fallback de Modelos para la llamada a la IA
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
      console.warn(`[DAREK Fallback] El modelo ${modelName} falló. Intentando con el siguiente...`, error.message);
    }
  }
  throw new Error('Todos los modelos de IA fallaron.');
}

// Servidor de Auto Ping para Render Gratis
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('DAREK v1 revOlution está activo.');
}).listen(PORT, () => {
  console.log(`[AutoPing] Servidor escuchando en el puerto ${PORT}`);
});

client.once('ready', () => {
  console.log(`[DAREK v1 revOlution] Online como ${client.user.tag}`);
  
  // Estado inicial por defecto
  client.user.setPresence({
    status: 'online',
    activities: [{ name: 'Analizando el entorno', type: ActivityType.Custom, state: 'DAREK Core v1' }]
  });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const nombreBot = client.user.username.toLowerCase();
  const contenido = message.content.toLowerCase();
  const fueMencionado = message.mentions.has(client.user.id);
  const esDM = !message.guild;
  const contieneNombre = contenido.includes(nombreBot);

  // Activación por mención, mensaje privado o si detecta su nombre en el chat
  if (fueMencionado || esDM || contieneNombre) {
    try {
      await message.channel.sendTyping();

      // --- COMANDOS ADMINISTRATIVOS DE ESTADO Y PRESENCIA ---
      if (message.content.startsWith('!estado')) {
        const estadoTexto = message.content.replace('!estado', '').trim();
        client.user.setPresence({
          activities: [{ name: 'Custom Status', type: ActivityType.Custom, state: estadoTexto }]
        });
        return message.reply(`Estado personalizado actualizado a: "${estadoTexto}"`);
      }

      if (message.content.startsWith('!presencia')) {
        const modo = message.content.replace('!presencia', '').trim().toLowerCase();
        // Modos: online, idle, dnd, invisible
        if (['online', 'idle', 'dnd', 'invisible'].includes(modo)) {
          client.user.setStatus(modo);
          return message.reply(`Presencia cambiada a: ${modo}`);
        }
      }

      // --- COMANDO DE MEMORIA A LARGO PLAZO ---
      if (message.content.startsWith('!recordar')) {
        const datoAMemorizar = message.content.replace('!recordar', '').trim();
        guardarMemoria(message.author.id, datoAMemorizar);
        return message.reply(`Guardado en mi memoria a largo plazo: "${datoAMemorizar}"`);
      }

      // --- LECTURA DE ACTIVIDAD DEL USUARIO QUE ESCRIBE ---
      let datosActividad = 'Sin actividad pública detectable.';
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

          datosActividad = `Estatus: ${pres.status} | Actividades: [${actividades}]`;
        }
      }

      // --- CAPTURA MÁXIMA DEL HISTORIAL DE MENSAJES DEL CANAL ---
      const ultimosMensajes = await message.channel.messages.fetch({ limit: 20 });
      const historialFormateado = ultimosMensajes
        .reverse()
        .map(m => `${m.author.username}: ${m.content}`)
        .join('\n');

      // --- PROCESAMIENTO DE IMÁGENES ---
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

      // --- CONSTRUCCIÓN DEL CONTEXTO COMPLETO ---
      const memoriasUsuario = obtenerMemorias(message.author.id);
      const systemPrompt = `${cargarPrompt()}

--- INFORMACIÓN EN TIEMPO REAL DEL USUARIO ---
Usuario: ${message.author.username} (Nick: ${message.member?.displayName || message.author.username})
Actividad detectada: ${datosActividad}

--- MEMORIAS A LARGO PLAZO DE ESTE USUARIO ---
${memoriasUsuario}

Instrucciones adicionales: Si el usuario te pide cambiar tu estado o presencia por texto normal, infórmale que use "!estado [texto]" o "!presencia [online/idle/dnd]".`;

      const promptEntrada = `Historial reciente del canal:\n${historialFormateado}\n\nMensaje actual de ${message.author.username}: ${message.content}`;
      partesEntrada.push(promptEntrada);

      // Generar respuesta con la IA usando la función de Fallback
      const respuestaIA = await generarRespuestaIA(partesEntrada, systemPrompt);

      if (respuestaIA.length > 2000) {
        const fragmentos = respuestaIA.match(/[\s\S]{1,1900}/g);
        for (const chunk of fragmentos) await message.reply(chunk);
      } else {
        await message.reply(respuestaIA);
      }

    } catch (error) {
      console.error('Error al procesar solicitud en DAREK:', error);
      await message.reply('Ocurrió un error al procesar tu solicitud.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
