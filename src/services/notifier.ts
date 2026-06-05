import { twilioClient, TWILIO_FROM, MANAGER_NUMBER } from '../config/twilio';

async function sendWhatsApp(to: string, body: string): Promise<void> {
  if (!TWILIO_FROM || !to) {
    console.warn('⚠️  [Notifier] Twilio not fully configured — skipping.');
    return;
  }
  try {
    const message = await twilioClient.messages.create({ from: TWILIO_FROM, to, body });
    console.log(`📤 [Notifier] Sent → ${to} | SID: ${message.sid}`);
  } catch (err) {
    console.error(`❌ [Notifier] Failed to send to ${to}:`, (err as Error).message);
  }
}

export async function alertManager(
  supplierName: string,
  referenceNumber: string,
  aiSummary: string
): Promise<void> {
  if (!MANAGER_NUMBER) return;
  const body =
    `🚨 *SA Logistics Agent — Manager Alert*\n\n` +
    `Supplier: ${supplierName}\nReference: ${referenceNumber}\n\n` +
    `AI Summary:\n${aiSummary}\n\n` +
    `_Log in to the dashboard for full details._`;
  await sendWhatsApp(MANAGER_NUMBER, body);
}

export async function confirmDelivery(
  senderNumber: string,
  referenceNumber: string,
  supplierName: string
): Promise<void> {
  const to = senderNumber.startsWith('whatsapp:') ? senderNumber : `whatsapp:${senderNumber}`;
  const body =
    `✅ *Delivery Confirmed*\n\n` +
    `Your update for *${supplierName}* (Ref: *${referenceNumber}*) has been logged.\n\n` +
    `_Powered by SA Logistics AI Agent 🇿🇦_`;
  await sendWhatsApp(to, body);
}