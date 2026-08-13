"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MegaApi = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const MEGA_API_URL = 'https://apistart01.megaapi.com.br/megastart-MBA6X7WV85VHYBVZKNVWAHXH6H7/message/sendText';
const MEGA_API_TOKEN = process.env.MEGA_API_TOKEN || '';
class MegaApi {
    /**
     * Envia uma mensagem de texto para um número via Mega API
     * @param phone Número de telefone no formato internacional (ex: 5511999999999)
     * @param text O texto da mensagem a ser enviada
     */
    static async sendMessage(phone, text) {
        try {
            if (!MEGA_API_TOKEN) {
                console.warn('AVISO: MEGA_API_TOKEN não está definido. A mensagem não será enviada de verdade.');
                console.log(`[SIMULAÇÃO DE ENVIO] Para: ${phone} | Mensagem: ${text}`);
                return true;
            }
            const response = await fetch(MEGA_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${MEGA_API_TOKEN}`
                },
                body: JSON.stringify({
                    number: phone,
                    text: text
                })
            });
            if (!response.ok) {
                console.error(`Mega API Erro HTTP: ${response.status} - ${response.statusText}`);
                return false;
            }
            const data = await response.json();
            console.log(`Mensagem enviada com sucesso para ${phone}.`);
            return true;
        }
        catch (error) {
            console.error(`Erro ao enviar mensagem para ${phone} via Mega API:`, error);
            return false;
        }
    }
}
exports.MegaApi = MegaApi;
