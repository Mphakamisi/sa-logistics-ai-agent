import express, { Request, Response } from 'express';
import { processIncomingMessage } from './aiAgent';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT ?? 3000;

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'active',
    service: 'SA Logistics AI Agent',
    version: '1.0.0',
    serverTime: new Date().toISOString(),
  });
});

// ─── WhatsApp webhook ─────────────────────────────────────────────────────────
app.post('/webhook/whatsapp', async (req: Request, res: Response) => {
  try {
    // Handle raw string bodies (e.g. PowerShell test payloads)
    let body = req.body as Record<string, unknown>;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body) as Record<string, unknown>;
      } catch {
        // Leave as-is if it can't be parsed
      }
    }

    const sender = (body['From'] ?? body['sender'] ?? 'Unknown Contact') as string;
    const message = (body['Body'] ?? body['message']) as string | undefined;

    if (!message) {
      console.log('⚠️  [Warning] Received a ping with no message content.');
      return res.status(400).json({ error: 'Payload must contain a message field.' });
    }

    console.log(`\n📥 [Incoming] From: ${sender} | Message: "${message}"`);

    const outcome = await processIncomingMessage(sender, message);

    if (outcome.success) {
      console.log('✅ [Workflow Complete] Agent processed successfully.');
      return res.status(200).json({ status: 'success', analysis: outcome.data });
    } else {
      console.error('❌ [Workflow Failed]', outcome.error);
      return res.status(500).json({ status: 'failure', message: outcome.error });
    }
  } catch (err) {
    console.error('🚨 [ROUTE CRASH]:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: (err as Error).message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 SA Logistics AI Agent running → http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health\n`);
});
