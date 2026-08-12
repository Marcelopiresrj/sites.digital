import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://ytmsqjmnrprlviczskxo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bXNxam1ucnBybHZpY3pza3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NzIyODcsImV4cCI6MjEwMTM0ODI4N30.iIW7-sOq_7GiSdYeNdQkWlNFT8E7su-FIAeFAbt61KI';

if (!supabaseUrl || (supabaseKey as string) === 'dummy_key_to_prevent_crash_on_boot') {
  console.error("ERRO CRÍTICO: As variáveis SUPABASE_URL e SUPABASE_ANON_KEY não estão definidas na Vercel.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
