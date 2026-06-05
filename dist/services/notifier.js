"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertManager = alertManager;
exports.confirmDelivery = confirmDelivery;
const twilio_1 = require("../config/twilio");
async function sendWhatsApp(to, body) {
    if (!twilio_1.TWILIO_FROM || !to) {
        console.warn('⚠️  [Notifier] Twilio not fully configured — skipping.');
        return;
    }
    try {
        const message = await twilio_1.twilioClient.messages.create({ from: twilio_1.TWILIO_FROM, to, body });
        console.log(`📤 [Notifier] Sent → ${to} | SID: ${message.sid}`);
    }
    catch (err) {
        console.error(`❌ [Notifier] Failed to send to ${to}:`, err.message);
    }
}
async function alertManager(supplierName, referenceNumber, aiSummary) {
    if (!twilio_1.MANAGER_NUMBER)
        return;
    const body = `🚨 *SA Logistics Agent — Manager Alert*\n\n` +
        `Supplier: ${supplierName}\nReference: ${referenceNumber}\n\n` +
        `AI Summary:\n${aiSummary}\n\n` +
        `_Log in to the dashboard for full details._`;
    await sendWhatsApp(twilio_1.MANAGER_NUMBER, body);
}
async function confirmDelivery(senderNumber, referenceNumber, supplierName) {
    const to = senderNumber.startsWith('whatsapp:') ? senderNumber : `whatsapp:${senderNumber}`;
    const body = `✅ *Delivery Confirmed*\n\n` +
        `Your update for *${supplierName}* (Ref: *${referenceNumber}*) has been logged.\n\n` +
        `_Powered by SA Logistics AI Agent 🇿🇦_`;
    await sendWhatsApp(to, body);
}
//# sourceMappingURL=notifier.js.map