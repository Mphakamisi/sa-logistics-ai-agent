import { GoogleGenAI } from '@google/genai';
import { pool } from './config/supabase';
import { alertManager, confirmDelivery } from './services/notifier';
import dotenv from 'dotenv';

dotenv.config();

const aiKey = process.env.GEMINI_API_KEY;
if (!aiKey) throw new Error('Missing GEMINI_API_KEY in your .env file.');

const ai = new GoogleGenAI({ apiKey: aiKey });

interface ParsedLogisticsData {
  intent: 'log_delivery' | 'update_status' | 'general_inquiry' | 'unknown';
  supplierName: string | null;
  referenceNumber: string | null;
  itemDescription: string | null;
  quantity: number | null;
  status: 'pending' | 'in_transit' | 'delivered' | 'delayed' | null;
  confidenceScore: number;
  managerAlertRequired: boolean;
  aiSummary: string;
  driverInfo?: string | null;
}

interface AgentResult { success: true; data: ParsedLogisticsData; }
interface AgentError { success: false; error: string; }

export async function processIncomingMessage(
  senderNumber: string,
  messageBody: string
): Promise<AgentResult | AgentError> {
  const client = await pool.connect();
  try {
    // ─── Step 1: Immutable audit trail ───────────────────────────────────────
    const logResult = await client.query(
      `INSERT INTO whatsapp_logs (sender_number, raw_message_body)
       VALUES ($1, $2) RETURNING id`,
      [senderNumber, messageBody]
    );
    const logId = logResult.rows[0].id;

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
      config: { responseMimeType: 'application/json' },
    });

    const aiOutputText = response.text;
    if (!aiOutputText) throw new Error('Gemini returned an empty response.');

    const cleanJson = aiOutputText.trim().replace(/^```json|^```|```$/g, '').trim();
    const parsedData: ParsedLogisticsData = JSON.parse(cleanJson);

    // ─── Step 3: Database upsert ──────────────────────────────────────────────
    if (
      (parsedData.intent === 'log_delivery' || parsedData.intent === 'update_status') &&
      parsedData.referenceNumber
    ) {
      const supplierName = parsedData.supplierName ?? 'Generic Logistics Hub';
      const preservedPayload = {
        originalText: messageBody,
        aiExtractedIntent: parsedData.intent,
        timestamp: new Date().toISOString(),
        ...parsedData,
      };

      await client.query(
        `INSERT INTO deliveries
           (supplier_name, reference_number, item_description, quantity_expected,
            current_status, last_ai_summary, assigned_driver_info, raw_payload, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
         ON CONFLICT (supplier_name, reference_number)
         DO UPDATE SET
           item_description = EXCLUDED.item_description,
           quantity_expected = EXCLUDED.quantity_expected,
           current_status = EXCLUDED.current_status,
           last_ai_summary = EXCLUDED.last_ai_summary,
           assigned_driver_info = EXCLUDED.assigned_driver_info,
           raw_payload = EXCLUDED.raw_payload,
           updated_at = now()`,
        [
          supplierName,
          parsedData.referenceNumber,
          parsedData.itemDescription ?? 'Assorted Stock',
          parsedData.quantity ?? 0,
          parsedData.status ?? 'pending',
          parsedData.aiSummary,
          parsedData.driverInfo ?? null,
          JSON.stringify(preservedPayload),
        ]
      );

      console.log(`✅ [DB] Synced: ${supplierName} — Ref: ${parsedData.referenceNumber}`);

      // ─── Step 4: Outbound notifications ──────────────────────────────────────
      if (parsedData.managerAlertRequired) {
        console.log('🚨 [Notifier] Manager alert triggered.');
        await alertManager(supplierName, parsedData.referenceNumber, parsedData.aiSummary);
      }
      if (parsedData.status === 'delivered') {
        console.log('📤 [Notifier] Sending delivery confirmation.');
        await confirmDelivery(senderNumber, parsedData.referenceNumber, supplierName);
      }
    }

    // ─── Step 5: Mark log as processed ───────────────────────────────────────
    await client.query(
      `UPDATE whatsapp_logs SET processed_by_ai = true WHERE id = $1`,
      [logId]
    );

    return { success: true, data: parsedData };
  } catch (error) {
    console.error('\n🚨 [CRITICAL AGENT ERROR]:', error);
    return { success: false, error: (error as Error).message };
  } finally {
    client.release();
  }
}
