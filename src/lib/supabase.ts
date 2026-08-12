import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Usa as variáveis de ambiente, com fallbacks opcionais caso precise debugar
const supabaseUrl = process.env.SUPABASE_URL || 'https://ytmsqjmnrprlviczskxo.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO: As variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não estão definidas no .env.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
