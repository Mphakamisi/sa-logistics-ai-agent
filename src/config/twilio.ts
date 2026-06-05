import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid) throw new Error('Missing TWILIO_ACCOUNT_SID in your .env file.');
if (!authToken) throw new Error('Missing TWILIO_AUTH_TOKEN in your .env file.');

export const twilioClient = twilio(accountSid, authToken);

export const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER ?? '';
export const MANAGER_NUMBER = process.env.MANAGER_ALERT_NUMBER ?? '';
