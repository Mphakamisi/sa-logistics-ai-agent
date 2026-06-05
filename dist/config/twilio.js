"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MANAGER_NUMBER = exports.TWILIO_FROM = exports.twilioClient = void 0;
const twilio_1 = __importDefault(require("twilio"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
if (!accountSid)
    throw new Error('Missing TWILIO_ACCOUNT_SID in your .env file.');
if (!authToken)
    throw new Error('Missing TWILIO_AUTH_TOKEN in your .env file.');
exports.twilioClient = (0, twilio_1.default)(accountSid, authToken);
exports.TWILIO_FROM = process.env.TWILIO_FROM_NUMBER ?? '';
exports.MANAGER_NUMBER = process.env.MANAGER_ALERT_NUMBER ?? '';
//# sourceMappingURL=twilio.js.map