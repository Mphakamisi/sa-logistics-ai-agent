"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const aiAgent_1 = require("./aiAgent");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
const PORT = process.env.PORT ?? 3000;
// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'active',
        service: 'SA Logistics AI Agent',
        version: '1.0.0',
        serverTime: new Date().toISOString(),
    });
});
// ─── WhatsApp webhook ─────────────────────────────────────────────────────────
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        // Handle raw string bodies (e.g. PowerShell test payloads)
        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            }
            catch {
                // Leave as-is if it can't be parsed
            }
        }
        const sender = (body['From'] ?? body['sender'] ?? 'Unknown Contact');
        const message = (body['Body'] ?? body['message']);
        if (!message) {
            console.log('⚠️  [Warning] Received a ping with no message content.');
            return res.status(400).json({ error: 'Payload must contain a message field.' });
        }
        console.log(`\n📥 [Incoming] From: ${sender} | Message: "${message}"`);
        const outcome = await (0, aiAgent_1.processIncomingMessage)(sender, message);
        if (outcome.success) {
            console.log('✅ [Workflow Complete] Agent processed successfully.');
            return res.status(200).json({ status: 'success', analysis: outcome.data });
        }
        else {
            console.error('❌ [Workflow Failed]', outcome.error);
            return res.status(500).json({ status: 'failure', message: outcome.error });
        }
    }
    catch (err) {
        console.error('🚨 [ROUTE CRASH]:', err);
        return res.status(500).json({
            error: 'Internal Server Error',
            details: err.message,
        });
    }
});
app.listen(PORT, () => {
    console.log(`\n🚀 SA Logistics AI Agent running → http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health\n`);
});
//# sourceMappingURL=index.js.map