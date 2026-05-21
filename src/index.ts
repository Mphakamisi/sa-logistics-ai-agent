import express from 'express';
import { processIncomingMessage } from './services/aiAgent';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'active', serverTime: new Date().toISOString() });
});

app.post('/webhook/whatsapp', async (req, res) => {
  try {
    // If PowerShell sends it as a raw string instead of an object, try to parse it
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        // Fallback if parsing fails
      }
    }

    const sender = body.From || body.sender || 'Unknown Contact';
    const message = body.Body || body.message;

    if (!message) {
      console.log('⚠️ [Warning] Received a ping with no message content.');
      return res.status(400).json({ error: 'Payload must contain a message.' });
    }

    console.log(`\n📥 [Incoming Network Ping] From: ${sender} | Content: "${message}"`);
    
    const outcome = await processIncomingMessage(sender, message);
    
    if (outcome.success) {
      console.log(`✅ [Workflow Complete] AI Actions Processed Fluently.`);
      return res.status(200).json({ status: 'success', systemAnalysis: outcome.data });
    } else {
      console.error(`❌ [Workflow Aborted] Agent processing failed internally.`);
      return res.status(500).json({ status: 'failure', message: outcome.error });
    }
  } catch (globalError) {
    console.error('🚨 [ROUTE CRASH]:', globalError);
    return res.status(500).json({ error: 'Internal Route Error', details: (globalError as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 AI Agent Production Server active on: http://localhost:${PORT}`);
});