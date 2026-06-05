import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL in your .env file.');
if (!supabaseKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in your .env file.');

export const supabase = createClient(supabaseUrl, supabaseKey);
