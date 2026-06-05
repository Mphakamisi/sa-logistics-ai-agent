# SA Logistics AI Agent 🇿🇦

> Autonomous AI backend that intercepts raw WhatsApp messages from drivers and suppliers, extracts structured logistics data, updates your operational database, and automatically fires outbound notifications — all without a human touching a keyboard.

Built specifically for South African SMEs.

---

## What It Does

A driver sends a WhatsApp voice-note transcript or text like:

> *"Boss, bakkie arrived DBN warehouse, ref SA-2291, 40 units of stock, all good — signed slip attached"*

The agent:
1. **Logs** the raw message as an immutable audit trail
2. **Parses** it with Gemini AI into a structured JSON payload (intent, supplier, reference number, status, quantity)
3. **Upserts** the data into your Supabase database — updating existing records or creating new ones
4. **Alerts** your manager via WhatsApp if the AI detects a problem, dispute, or low-confidence parse
5. **Confirms** delivery back to the driver automatically when status is `delivered`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Server | Express.js |
| AI Engine | Google Gemini 2.5 Flash |
| Database | Supabase (PostgreSQL) |
| Notifications | Twilio WhatsApp API |

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/Mphakamisi/sa-logistics-ai-agent.git
cd sa-logistics-ai-agent
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your keys. You need:
- **Supabase** URL + service role key → [supabase.com/dashboard](https://supabase.com/dashboard)
- **Gemini API key** → [aistudio.google.com](https://aistudio.google.com/app/apikey)
- **Twilio** account SID, auth token, and a WhatsApp-enabled number → [console.twilio.com](https://console.twilio.com)

### 3. Set up Supabase tables

Run these SQL migrations in your Supabase SQL editor:

```sql
-- Immutable audit trail of all incoming messages
create table whatsapp_logs (
  id uuid primary key default gen_random_uuid(),
  sender_number text not null,
  raw_message_body text not null,
  processed_by_ai boolean default false,
  created_at timestamptz default now()
);

-- Master delivery tracking pipeline
create table deliveries (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  reference_number text not null,
  item_description text,
  quantity_expected integer default 0,
  current_status text default 'pending',
  last_ai_summary text,
  assigned_driver_info text,
  raw_payload jsonb,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  constraint deliveries_unique_ref unique (supplier_name, reference_number)
);

-- Regional supplier directory
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  region text,
  contact_number text,
  created_at timestamptz default now()
);
```

### 4. Run in development

```bash
npm run dev
```

### 5. Build for production

```bash
npm run build
npm start
```

---

## API Reference

### `GET /health`
Returns server status.

```json
{
  "status": "active",
  "service": "SA Logistics AI Agent",
  "version": "1.0.0",
  "serverTime": "2026-06-05T10:00:00.000Z"
}
```

### `POST /webhook/whatsapp`
Main entry point. Accepts a message payload from WhatsApp (via Twilio webhook) or your own test client.

**Request body:**
```json
{
  "From": "whatsapp:+27821234567",
  "Body": "Boss, bakkie arrived DBN, ref SA-2291, 40 units delivered"
}
```

**Response (success):**
```json
{
  "status": "success",
  "analysis": {
    "intent": "log_delivery",
    "supplierName": "DBN Warehouse",
    "referenceNumber": "SA-2291",
    "itemDescription": "40 units",
    "quantity": 40,
    "status": "delivered",
    "confidenceScore": 0.97,
    "managerAlertRequired": false,
    "aiSummary": "Delivery SA-2291 confirmed at Durban warehouse. 40 units received in good condition."
  }
}
```

---

## Outbound Notifications (Client Summons)

The agent automatically fires outbound WhatsApp messages in two scenarios:

| Trigger | Recipient | Message |
|---|---|---|
| `status = "delivered"` | Original sender (driver) | Delivery confirmation |
| `managerAlertRequired = true` | Manager (from `.env`) | Alert with AI summary |

Manager alerts fire when the AI detects: delivery problems, disputes, damaged goods, delays, or ambiguous messages (confidence < 0.5).

---

## AI Schema (Forced JSON Output)

```typescript
{
  intent: "log_delivery" | "update_status" | "general_inquiry" | "unknown"
  supplierName: string | null
  referenceNumber: string | null
  itemDescription: string | null
  quantity: number | null
  status: "pending" | "in_transit" | "delivered" | "delayed" | null
  confidenceScore: number        // 0–1
  managerAlertRequired: boolean
  aiSummary: string
  driverInfo: string | null
}
```

---

## Database Architecture

```
whatsapp_logs          deliveries                  suppliers
─────────────          ──────────                  ─────────
id                     id                          id
sender_number          supplier_name ──────────→  name
raw_message_body       reference_number            region
processed_by_ai        item_description            contact_number
created_at             quantity_expected           created_at
                       current_status
                       last_ai_summary
                       assigned_driver_info
                       raw_payload (JSONB)
                       updated_at / created_at
```

The `raw_payload` JSONB column captures the full AI output on every update. This means even if your schema evolves, you never lose historical data — the agent adapts automatically.

---

## Project Structure

```
sa-logistics-ai-agent/
├── src/
│   ├── config/
│   │   ├── supabase.ts       # Supabase client initialisation
│   │   └── twilio.ts         # Twilio client initialisation
│   ├── services/
│   │   ├── aiAgent.ts        # Core AI processing pipeline
│   │   └── notifier.ts       # Outbound WhatsApp notification service
│   └── index.ts              # Express server entry point
├── .env.example              # Environment variable template
├── package.json
├── tsconfig.json
└── README.md
```

---

## Built for SA

The AI is specifically prompted to understand South African logistics context:
- City shorthand: JHB, DBN, CPT, PTA
- Local terms: bakkie, delivery note, slip, indoda, laai
- SA number formats for Twilio integration

---

*Built by [Mphakamisi Ngidi](https://github.com/Mphakamisi) · Durban, South Africa*
