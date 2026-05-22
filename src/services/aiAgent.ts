import { GoogleGenAI } from '@google/genai';
import { supabase } from '../config/supabase';
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
  driverInfo?: string | null; // Added to catch extra drift fields from the payload dynamically
}

export async function processIncomingMessage(senderNumber: string, messageBody: string) {
  try {
    // 1. Audit trail: Log raw text to Supabase first
    const { data: rawLog, error: logError } = await supabase
      .from('whatsapp_logs')
      .insert([{ sender_number: senderNumber, raw_message_body: messageBody }])
      .select()
      .single();

    if (logError) {
      console.error('❌ Supabase Log Error:', logError.message);
      throw new Error(`Supabase Logging Failed: ${logError.message}`);
    }

    // 2. Call Gemini using a completely clean JSON format instruction
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an elite, highly precise AI Logistics Coordinator built for South African businesses.
      Analyze the text from a driver or courier and map it out into a valid JSON object matching the requested schema.

      Context Guidelines:
      - Recognize SA cities and landmarks (e.g., Joburg, JHB, DBN, Durban, Cape Town).
      - Handle local slang text context ("bakkie", "delivery note", "slip", "boss").
      
      Output Schema requirements:
      Return ONLY a raw JSON object with these exact keys:
      {
        "intent": "log_delivery" | "update_status" | "general_inquiry" | "unknown",
        "supplierName": string or null,
        "referenceNumber": string or null,
        "itemDescription": string or null,
        "quantity": integer number or null,
        "status": "pending" | "in_transit" | "delivered" | "delayed" or null,
        "confidenceScore": number between 0 and 1,
        "managerAlertRequired": boolean true/false,
        "aiSummary": string summary of actions,
        "driverInfo": string or null
      }

      Raw Message Content: "${messageBody}"`,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const aiOutputText = response.text;
    if (!aiOutputText) throw new Error('Gemini API returned an empty text stream.');

    // Parse the generated JSON response text natively
    const parsedData: ParsedLogisticsData = JSON.parse(aiOutputText.trim());

    // 3. Automation Execution Layer
    if ((parsedData.intent === 'log_delivery' || parsedData.intent === 'update_status') && parsedData.referenceNumber) {
      
      // Step A: Extract a fallback tenant/supplier name if the incoming payload is missing one
      const runningSupplier = parsedData.supplierName || 'Generic Logistics Hub';

      // Step B: Build a flexible, preserved raw metadata object to capture schema drift 
      // This saves the complete operational structure even if layout fields mutate over time
      const preservedPayload = {
        originalText: messageBody,
        aiExtractedIntent: parsedData.intent,
        timestamp: new Date().toISOString(),
        ...parsedData // Spreads any unexpected extra key-values the AI parsed dynamically
      };

      // Step C: Run the multi-tenant secure upsert query mapping to the composite constraint
      const { error: upsertError } = await supabase
        .from('deliveries')
        .upsert({
          supplier_name: runningSupplier,
          reference_number: parsedData.referenceNumber,
          item_description: parsedData.itemDescription || 'Assorted Stock',
          quantity_expected: parsedData.quantity || 0,
          current_status: parsedData.status || 'pending',
          last_ai_summary: parsedData.aiSummary,
          assigned_driver_info: parsedData.driverInfo || null,
          raw_payload: preservedPayload, // 🚀 Capturing flexible schema drift here
          updated_at: new Date().toISOString()
        }, { 
          // 🛡️ Match the composite unique constraint defined in your database migration
          onConflict: 'supplier_name,reference_number' 
        });

      if (upsertError) {
        console.error('❌ Supabase Upsert Error:', upsertError.message);
        throw new Error(`Supabase Upsert Failed: ${upsertError.message}`);
      }

      console.log(`\n✅ [Workflow Complete] Tenant Isolated Data Synced Fluently for: ${runningSupplier} (${parsedData.referenceNumber})`);
    }

    // 4. Mark log as processed by AI
    await supabase
      .from('whatsapp_logs')
      .update({ processed_by_ai: true })
      .eq('id', rawLog.id);

    return {
      success: true,
      data: parsedData
    };

  } catch (error) {
    console.error('\n🚨 [CRITICAL AGENT ERROR]:', error);
    return { success: false, error: (error as Error).message };
  }
}