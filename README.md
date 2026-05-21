# Autonomous AI Logistics & Inventory Agent for SA SMEs 🇿🇦

A high-performance, cost-effective AI automation backend engineered specifically for South African small-to-medium businesses. This system intercepts raw delivery logistics updates (designed for multi-channel platforms like WhatsApp), runs them through an intelligent agent execution layer, extracts structured data, and automatically updates operational databases in real time.

## 🚀 The Business Value
- **Reduces Overhead:** Eliminates the need for manual tracking, parsing, and logging of supplier notes and driver updates.
- **Protects Cash Flow:** Instantly logs structural tracking reference data, reducing delivery delays and supplier frictions.
- **Built for SA Context:** Natively optimized to understand South African geographical layouts (JHB, DBN, CPT) and local logistical shorthand ("bakkie", "slip", "delivery note").

## 🛠️ Tech Stack
- **Runtime:** Node.js with TypeScript
- **Server Framework:** Express.js
- **Database Layer:** Supabase (PostgreSQL engine utilizing automated structural UPSERT mechanics)
- **AI Engine:** Google Gen AI SDK running `gemini-2.5-flash` for ultra-low token cost allocations

## 📊 Database Architecture
The system dynamically orchestrates data across three relational cloud structures via secure background transaction overrides:
1. `whatsapp_logs` — Immutable audit trail of raw incoming network data.
2. `deliveries` — The master tracking pipeline anchoring delivery reference codes, live statuses, quantities, and AI generated business summaries.
3. `suppliers` — Regional procurement directories.

## ⚙️ Core Schema Strategy (Forced JSON)
The agent forces the LLM context matrix into an explicit, typed schema framework to guarantee zero-fault JSON structural parsings:
```json
{
  "intent": "log_delivery" | "update_status" | "general_inquiry" | "unknown",
  "supplierName": "string" | null,
  "referenceNumber": "string" | null,
  "itemDescription": "string" | null,
  "quantity": "integer" | null,
  "status": "pending" | "in_transit" | "delivered" | "delayed" | null,
  "confidenceScore": "number",
  "managerAlertRequired": "boolean",
  "aiSummary": "string"
}