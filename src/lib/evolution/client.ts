/**
 * WKontrolAI — Evolution API v2 Client
 * Integração HTTP com o engine WhatsApp (Evolution API)
 */

import { evolutionSendTextPayloadSchema } from '@/lib/validations/webhook';
import dns from 'node:dns/promises';

export interface DownloadedMediaResult {
  buffer: Buffer;
  mimetype: string;
  base64: string;
}
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // 25 MB max (alinhado aos limites do Groq Whisper e DeepSeek Vision)
const MAX_BASE64_LENGTH = Math.ceil((MAX_MEDIA_BYTES * 4) / 3); // ~33.5 MB de caracteres base64

/**
 * Validação adversarial contra SSRF:
 * Bloqueia localhost, loopback (127.0.0.0/8), IPs privados (RFC 1918),
 * Link-local/Cloud Metadata (169.254.0.0/16, metadata.google.internal),
 * IPv6 privados/mapeados e nomes de host sem ponto (containers Docker na mesma rede: redis, postgres, evolution).
 */
function isPrivateOrInternalHost(host: string): boolean {
  const cleanHost = host.toLowerCase().trim().replace(/^\[|\]$/g, '');

  // 1. Hostnames sem ponto (nomes de serviços/containers Docker: redis, postgres, evolution, etc.)
  if (!cleanHost.includes('.')) {
    return true;
  }

  // 2. TLDs internos e de intranet
  if (
    cleanHost.endsWith('.internal') ||
    cleanHost.endsWith('.local') ||
    cleanHost.endsWith('.lan') ||
    cleanHost.endsWith('.localdomain') ||
    cleanHost.endsWith('.localhost')
  ) {
    return true;
  }

  // 3. Loopback (127.0.0.0/8, 0.0.0.0, localhost)
  if (
    cleanHost === 'localhost' ||
    cleanHost === '0.0.0.0' ||
    cleanHost.startsWith('127.') ||
    cleanHost === '::1' ||
    cleanHost === '0'
  ) {
    return true;
  }

  // 4. Endereços privados RFC 1918 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  if (
    cleanHost.startsWith('10.') ||
    cleanHost.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(cleanHost)
  ) {
    return true;
  }

  // 5. Link-local e Cloud Metadata (169.254.0.0/16, metadata.google.internal)
  if (cleanHost.startsWith('169.254.') || cleanHost === 'metadata.google.internal') {
    return true;
  }

  // 6. IPv6 privado, link-local ou IPv4-mapped
  if (
    cleanHost.startsWith('fe80:') ||
    cleanHost.startsWith('fc00:') ||
    cleanHost.startsWith('fd00:') ||
    cleanHost.includes('::ffff:')
  ) {
    return true;
  }

  return false;
}

/**
 * Verifica se uma URL pertence à CDN de mídia do WhatsApp/Facebook.
 * Arquivos baixados diretamente dessas URLs vêm criptografados de ponta a ponta (AES-CBC)
 * e DEVEM ser descriptografados através da Evolution API.
 */
export function isWhatsAppCdnUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'whatsapp.net' ||
      host.endsWith('.whatsapp.net') ||
      host === 'whatsapp.com' ||
      host.endsWith('.whatsapp.com') ||
      host.includes('mmg.whatsapp.net') ||
      host.includes('fbcdn.net')
    );
  } catch {
    return false;
  }
}

export class EvolutionApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly instanceName: string;

  constructor() {
    this.baseUrl = (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/$/, '');
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
    this.instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'wkontrol_bot';
  }

  /**
   * Envia uma mensagem de texto no WhatsApp para o número indicado.
   */
  async sendTextMessage(toPhone: string, text: string): Promise<Record<string, unknown>> {
    // Normaliza o número: extrai apenas dígitos
    const cleanNumber = toPhone.replace(/\D/g, '');

    const payload = evolutionSendTextPayloadSchema.parse({
      number: cleanNumber,
      text,
      delay: 1200,
      linkPreview: false,
    });

    const url = `${this.baseUrl}/message/sendText/${this.instanceName}`;

    console.log(`[Evolution API Client] Enviando mensagem (${text.length} chars) para ${cleanNumber} via ${url}...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey,
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      console.error(
        `[Evolution API Send Error] (${response.status}) ao enviar para ${cleanNumber} via ${url}: ${errorBody}`
      );
      if (response.status === 404) {
        console.error(
          `[Evolution API 404] Instância "${this.instanceName}" não encontrada. Verifique se ela foi criada e conectada no WhatsApp.`
        );
      } else if (response.status === 401 || response.status === 403) {
        console.error(
          `[Evolution API 401/403] Chave apikey não autorizada. Verifique se EVOLUTION_API_KEY confere com a Evolution API.`
        );
      }
      throw new Error(
        `Falha ao enviar mensagem WhatsApp via Evolution API (${response.status}): ${errorBody}`
      );
    }

    const result = (await response.json()) as Record<string, unknown>;
    console.log(`[Evolution API Send OK] Mensagem entregue com sucesso para ${cleanNumber}`);
    return result;
  }

  /**
   * Envia botões interativos no WhatsApp para o número indicado.
   * Devido ao bloqueio intencional da Meta a stanzas buttonsMessage/interactiveMessage
   * em instâncias não-oficiais do Baileys (erro "This message couldn't load"), formata
   * título, descrição e lista de botões em texto estruturado limpo e entrega via sendTextMessage.
   */
  async sendInteractiveButtons(
    toPhone: string,
    title: string,
    description: string,
    buttons: Array<{ id: string; text: string }>
  ): Promise<Record<string, unknown>> {
    let formattedText = '';
    if (title && title.trim()) {
      formattedText += `*${title.trim()}*\n\n`;
    }
    formattedText += description.trim();

    // Se a descrição ainda não contiver as opções dos botões formatadas, anexa-as
    const hasButtonsListed = buttons.some((b, i) =>
      description.includes(`[${i + 1}]`) || description.includes(b.text)
    );

    if (!hasButtonsListed && buttons.length > 0) {
      formattedText += '\n\n👉 *Escolha uma opção:*\n';
      buttons.forEach((btn, idx) => {
        formattedText += `[${idx + 1}] ${btn.text}\n`;
      });
      formattedText += `\n💡 *Dica:* Responda com o número correspondente (ou por áudio/texto).`;
    }

    return await this.sendTextMessage(toPhone, formattedText);
  }

  /**
   * Baixa ou decodifica a mídia (áudio OGG ou imagem) associada à mensagem recebida.
   * Suporta:
   * 0. Decodificação direta se mediaBase64 já foi entregue no webhook (zero chamadas de rede)
   * 1. Download direto via URL pública segura (com proteção SSRF e limite de tamanho) — URLs da CDN do WhatsApp são puladas pois são criptografadas
   * 2. Descriptografia via /chat/getBase64FromMediaMessage/{instance} com estrutura Baileys completa
   */
  async downloadMedia(
    messageKey: { id: string; remoteJid?: string; fromMe?: boolean },
    mediaUrl?: string | null,
    mediaBase64?: string | null,
    mediaPayload?: Record<string, unknown> | null,
    mimetypeFallback?: string
  ): Promise<DownloadedMediaResult> {
    // 0. Se já possuir mediaBase64 (seja vindo no payload ou extraído), utiliza diretamente sem chamadas de rede
    if (mediaBase64 && typeof mediaBase64 === 'string' && mediaBase64.trim().length > 0) {
      if (mediaBase64.length > MAX_BASE64_LENGTH) {
        throw new Error(
          `Tamanho do Base64 da mídia (${mediaBase64.length} chars) excede o limite máximo de ${MAX_BASE64_LENGTH}`
        );
      }
      const cleanBase64 = mediaBase64.replace(/^data:[^;]+;base64,/, '').trim();
      const buffer = Buffer.from(cleanBase64, 'base64');
      if (buffer.length > MAX_MEDIA_BYTES) {
        throw new Error(
          `Buffer da mídia decodificada (${buffer.length} bytes) excede o limite de ${MAX_MEDIA_BYTES} bytes`
        );
      }
      return {
        buffer,
        mimetype: mimetypeFallback || 'application/octet-stream',
        base64: cleanBase64,
      };
    }

    // 1. Download direto via HTTP GET apenas para URLs públicas externas que NÃO sejam da CDN do WhatsApp
    // ATENÇÃO: URLs da CDN do WhatsApp (*.whatsapp.net / mmg.whatsapp.net) NUNCA devem ser baixadas via HTTP GET direto,
    // pois a CDN entrega os bytes ENCRIPTADOS (ciphertext AES). Elas devem passar pelo endpoint de descriptografia da Evolution API!
    const isWhatsAppCdn = mediaUrl ? isWhatsAppCdnUrl(mediaUrl) : false;

    if (
      mediaUrl &&
      !isWhatsAppCdn &&
      (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://'))
    ) {
      try {
        const parsedUrl = new URL(mediaUrl);
        const host = parsedUrl.hostname;

        if (!isPrivateOrInternalHost(host)) {
          // Proteção contra DNS Rebinding: resolve o host e valida se o IP de destino é privado ou loopback
          try {
            const { address } = await dns.lookup(host);
            if (isPrivateOrInternalHost(address)) {
              console.warn(
                `[EvolutionClient SSRF Guard] Bloqueado DNS Rebinding: host "${host}" resolveu para IP privado ${address}`
              );
              throw new Error(`DNS rebinding detectado para ${host} (${address})`);
            }
          } catch (dnsErr) {
            console.warn(`[EvolutionClient SSRF Guard] Falha na resolução DNS segura para "${host}":`, dnsErr);
            throw dnsErr;
          }

          const directResponse = await fetch(mediaUrl, {
            signal: AbortSignal.timeout(10000),
          });

          if (directResponse.ok) {
            // Checa Content-Length antes de ler todo o payload no heap
            const contentLengthHeader = directResponse.headers.get('content-length');
            if (contentLengthHeader) {
              const contentLength = parseInt(contentLengthHeader, 10);
              if (!isNaN(contentLength) && contentLength > MAX_MEDIA_BYTES) {
                throw new Error(
                  `Tamanho da mídia (${contentLength} bytes) excede o limite máximo permitido de ${MAX_MEDIA_BYTES} bytes`
                );
              }
            }

            const arrayBuffer = await directResponse.arrayBuffer();
            if (arrayBuffer.byteLength > MAX_MEDIA_BYTES) {
              throw new Error(
                `Mídia baixada (${arrayBuffer.byteLength} bytes) excede o limite máximo de ${MAX_MEDIA_BYTES} bytes`
              );
            }

            const buffer = Buffer.from(arrayBuffer);
            const mimetype =
              directResponse.headers.get('content-type') || mimetypeFallback || 'application/octet-stream';
            const base64 = buffer.toString('base64');
            return { buffer, mimetype, base64 };
          }
        } else {
          console.warn(`[EvolutionClient SSRF Guard] Bloqueada tentativa de download de host interno/privado: ${host}`);
        }
      } catch (err) {
        console.warn('[EvolutionClient] Falha no download direto via mediaUrl, tentando endpoint base64...', err);
      }
    }

    // 2. Fallback: Recupera e descriptografa mídia através da Evolution API v2
    // Envia a estrutura completa exigida pelo Baileys/Evolution API v2
    const url = `${this.baseUrl}/chat/getBase64FromMediaMessage/${this.instanceName}`;

    let messagePayloadToSend: Record<string, unknown>;

    if (mediaPayload && typeof mediaPayload === 'object') {
      if ('key' in mediaPayload && 'message' in mediaPayload) {
        messagePayloadToSend = mediaPayload;
      } else if (
        'audioMessage' in mediaPayload ||
        'imageMessage' in mediaPayload ||
        'documentMessage' in mediaPayload
      ) {
        messagePayloadToSend = {
          key: {
            id: messageKey.id,
            ...(messageKey.remoteJid ? { remoteJid: messageKey.remoteJid } : {}),
            fromMe: messageKey.fromMe ?? false,
          },
          message: mediaPayload,
        };
      } else {
        const typeKey =
          mimetypeFallback?.startsWith('image') || 'caption' in mediaPayload
            ? 'imageMessage'
            : mimetypeFallback?.startsWith('audio') || 'ptt' in mediaPayload || 'seconds' in mediaPayload
              ? 'audioMessage'
              : 'documentMessage';

        messagePayloadToSend = {
          key: {
            id: messageKey.id,
            ...(messageKey.remoteJid ? { remoteJid: messageKey.remoteJid } : {}),
            fromMe: messageKey.fromMe ?? false,
          },
          message: {
            [typeKey]: mediaPayload,
          },
        };
      }
    } else {
      messagePayloadToSend = {
        key: {
          id: messageKey.id,
          ...(messageKey.remoteJid ? { remoteJid: messageKey.remoteJid } : {}),
          fromMe: messageKey.fromMe ?? false,
        },
      };
    }

    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey,
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        message: messagePayloadToSend,
        convertToMp4: false,
      }),
    });

    // Se falhar e tínhamos enviado mensagem aninhada, tenta com o formato minimalista oficial { message: { key: { id } } }
    if (!response.ok && messagePayloadToSend.message) {
      console.warn(
        `[EvolutionClient] getBase64FromMediaMessage com payload aninhado retornou ${response.status}. Tentando com key minimalista...`
      );
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey,
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          message: {
            key: {
              id: messageKey.id,
            },
          },
          convertToMp4: false,
        }),
      });
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Falha ao obter mídia da mensagem ${messageKey.id} via Evolution API (${response.status}): ${errorBody}`
      );
    }

    const data = (await response.json()) as {
      base64?: string;
      mimetype?: string;
    };

    if (!data.base64) {
      throw new Error(`Evolution API não retornou base64 para a mensagem ${messageKey.id}`);
    }

    if (data.base64.length > MAX_BASE64_LENGTH) {
      throw new Error(
        `Tamanho do Base64 da mídia (${data.base64.length} chars) excede o limite máximo suportado`
      );
    }

    // Remove prefixo de data URI caso presente (ex: data:audio/ogg;base64,...)
    const cleanBase64 = data.base64.replace(/^data:[^;]+;base64,/, '').trim();
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length > MAX_MEDIA_BYTES) {
      throw new Error(
        `Buffer da mídia decodificada (${buffer.length} bytes) excede o limite de ${MAX_MEDIA_BYTES} bytes`
      );
    }

    const mimetype = data.mimetype || mimetypeFallback || 'application/octet-stream';

    return {
      buffer,
      mimetype,
      base64: cleanBase64,
    };
  }
}

export const evolutionApi = new EvolutionApiClient();
