import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Usa as variáveis de ambiente, com fallbacks opcionais caso precise debugar
const supabaseUrl = process.env.SUPABASE_URL || 'https://ytmsqjmnrprlviczskxo.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.supabase_anon_key || 'dummy_key_to_prevent_crash_on_boot';

if (!supabaseUrl || supabaseKey === 'dummy_key_to_prevent_crash_on_boot') {
  console.error("ERRO CRÍTICO: As variáveis SUPABASE_URL e SUPABASE_ANON_KEY não estão definidas na Vercel.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
