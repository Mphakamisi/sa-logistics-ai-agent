"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processIncomingMessage = processIncomingMessage;
const genai_1 = require("@google/genai");
const supabase_1 = require("./config/supabase");
const notifier_1 = require("./services/notifier");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const aiKey = process.env.GEMINI_API_KEY;
if (!aiKey)
    throw new Error('Missing GEMINI_API_KEY in your .env file.');
const ai = new genai_1.GoogleGenAI({ apiKey: aiKey });
async function processIncomingMessage(senderNumber, messageBody) {
    try {
        // ─── Step 1: Immutable audit trail ───────────────────────────────────────
        const { data: rawLog, error: logError } = await supabase_1.supabase
            .from('whatsapp_logs')
            .insert([{ sender_number: senderNumber, raw_message_body: messageBody }])
            .select()
            .single();
        if (logError) {
            console.error('❌ Supabase Log Error:', logError.message);
            throw new Error(`Supabase Logging Failed: ${logError.message}`);
        }
        // ─── Step 2: Gemini AI parsing ────────────────────────────────────────────
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are an elite, highly precise AI Logistics Coordinator built for South African businesses.
      Analyze the text from a driver or courier and map it into a valid JSON object matching the schema below.

      Context Guidelines:
      - Recognise SA cities and landmarks (e.g., Joburg, JHB, DBN, Durban, Cape Town, CPT, PTA, Pretoria).
      - Handle local slang (e.g. "bakkie", "delivery note", "slip", "boss", "indoda", "laai").
      - Set managerAlertRequired=true if the message signals a problem, delay, damage, or dispute.
      - Set managerAlertRequired=true if confidenceScore is below 0.5 (ambiguous message).

      Return ONLY a raw JSON object with these exact keys — no markdown, no backticks:
      {
        "intent": "log_delivery" | "update_status" | "general_inquiry" | "unknown",
        "supplierName": string or null,
        "referenceNumber": string or null,
        "itemDescription": string or null,
        "quantity": integer number or null,
        "status": "pending" | "in_transit" | "delivered" | "delayed" or null,
        "confidenceScore": number between 0 and 1,
        "managerAlertRequired": boolean,
        "aiSummary": string summary of actions taken,
        "driverInfo": string or null
      }

      Raw Message Content: "${messageBody}"`,
            config: {
                responseMimeType: 'application/json',
            },
        });
        const aiOutputText = response.text;
        if (!aiOutputText)
            throw new Error('Gemini returned an empty response.');
        // Strip any stray markdown fences before parsing
        const cleanJson = aiOutputText.trim().replace(/^```json|^```|```$/g, '').trim();
        const parsedData = JSON.parse(cleanJson);
        // ─── Step 3: Database upsert ──────────────────────────────────────────────
        if ((parsedData.intent === 'log_delivery' || parsedData.intent === 'update_status') &&
            parsedData.referenceNumber) {
            const supplierName = parsedData.supplierName ?? 'Generic Logistics Hub';
            // Preserve full payload to handle future schema drift gracefully
            const preservedPayload = {
                originalText: messageBody,
                aiExtractedIntent: parsedData.intent,
                timestamp: new Date().toISOString(),
                ...parsedData,
            };
            const { error: upsertError } = await supabase_1.supabase
                .from('deliveries')
                .upsert({
                supplier_name: supplierName,
                reference_number: parsedData.referenceNumber,
                item_description: parsedData.itemDescription ?? 'Assorted Stock',
                quantity_expected: parsedData.quantity ?? 0,
                current_status: parsedData.status ?? 'pending',
                last_ai_summary: parsedData.aiSummary,
                assigned_driver_info: parsedData.driverInfo ?? null,
                raw_payload: preservedPayload,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'supplier_name,reference_number' });
            if (upsertError) {
                console.error('❌ Supabase Upsert Error:', upsertError.message);
                throw new Error(`Supabase Upsert Failed: ${upsertError.message}`);
            }
            console.log(`✅ [DB] Synced: ${supplierName} — Ref: ${parsedData.referenceNumber} — Status: ${parsedData.status}`);
            // ─── Step 4: Outbound notifications (client summons) ───────────────────
            // 4a. Manager alert — fires when AI flags something critical
            if (parsedData.managerAlertRequired) {
                console.log('🚨 [Notifier] Manager alert triggered.');
                await (0, notifier_1.alertManager)(supplierName, parsedData.referenceNumber, parsedData.aiSummary);
            }
            // 4b. Delivery confirmation — fires when a delivery is marked as delivered
            if (parsedData.status === 'delivered') {
                console.log('📤 [Notifier] Sending delivery confirmation to sender.');
                await (0, notifier_1.confirmDelivery)(senderNumber, parsedData.referenceNumber, supplierName);
            }
        }
        // ─── Step 5: Mark log entry as processed ─────────────────────────────────
        await supabase_1.supabase
            .from('whatsapp_logs')
            .update({ processed_by_ai: true })
            .eq('id', rawLog.id);
        return { success: true, data: parsedData };
    }
    catch (error) {
        console.error('\n🚨 [CRITICAL AGENT ERROR]:', error);
        return { success: false, error: error.message };
    }
}
//# sourceMappingURL=aiAgent.js.map