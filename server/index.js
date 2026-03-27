const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// ─── System instruction ───────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION =
  process.env.SYSTEM_INSTRUCTION ||
  'You are a helpful, concise, and friendly AI assistant. ' +
  'Answer clearly and accurately. Use markdown formatting where it helps readability.';

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Simple request logger
app.use((req, _res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name: 'gemini-chat-server',
    version: '2.0.0',
    model: modelName,
    status: 'ok',
    endpoints: ['GET /', 'GET /health', 'POST /chat'],
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    apiKeyConfigured: Boolean(apiKey),
    model: modelName,
    uptime: Math.floor(process.uptime()),
  });
});

app.post('/chat', async (req, res) => {
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server misconfiguration: GEMINI_API_KEY is not set.',
    });
  }

  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '"messages" must be a non-empty array.' });
  }

  // Build contents, filtering malformed entries
  const contents = messages
    .filter(
      (m) =>
        m &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0 &&
        (m.role === 'user' || m.role === 'model')
    )
    .map((m) => ({
      role: m.role,
      parts: [{ text: m.content.trim() }],
    }));

  if (contents.length === 0) {
    return res.status(400).json({ error: 'No valid user/model messages found.' });
  }

  // Gemini requires first message to be from user
  if (contents[0].role !== 'user') {
    return res.status(400).json({ error: 'First message must be from the user.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const result = await model.generateContent({ contents });
    const text = result.response.text();

    return res.json({ text, model: modelName });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const msg = raw.toLowerCase();

    console.error('[Chat error]', raw);

    if (msg.includes('api key') || msg.includes('api_key_invalid') || msg.includes('permission_denied')) {
      return res.status(401).json({ error: 'Invalid or expired Gemini API key.' });
    }
    if (msg.includes('quota') || msg.includes('resource_exhausted')) {
      return res.status(429).json({ error: 'Gemini API quota exceeded. Try again later.' });
    }
    if (msg.includes('candidate was blocked') || msg.includes('safety')) {
      return res.status(422).json({ error: 'Response blocked due to safety filters. Try rephrasing.' });
    }
    if (msg.includes('deadline_exceeded') || msg.includes('timeout')) {
      return res.status(504).json({ error: 'Gemini request timed out. Please retry.' });
    }

    return res.status(500).json({ error: 'Unable to reach Gemini right now. Please try again.' });
  }
});

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`\n🚀 Gemini Chat proxy running at http://localhost:${port}`);
  console.log(`   Model : ${modelName}`);
  console.log(`   API Key configured: ${Boolean(apiKey)}\n`);
});
