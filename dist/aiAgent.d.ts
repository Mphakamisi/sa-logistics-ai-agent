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
interface AgentResult {
    success: true;
    data: ParsedLogisticsData;
}
interface AgentError {
    success: false;
    error: string;
}
export declare function processIncomingMessage(senderNumber: string, messageBody: string): Promise<AgentResult | AgentError>;
export {};
//# sourceMappingURL=aiAgent.d.ts.map