"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Usa as variáveis de ambiente, com fallbacks opcionais caso precise debugar
const supabaseUrl = process.env.SUPABASE_URL || 'https://ytmsqjmnrprlviczskxo.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
if (!supabaseUrl || !supabaseKey) {
    console.error("ERRO: As variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não estão definidas no .env.");
}
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
