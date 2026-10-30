/**
 * WKontrolAI — Schemas de Validação de Webhooks (Evolution API) & Mensageria
 * Runtime validation para payloads recebidos e transmitidos via WhatsApp
 */

import { z } from 'zod';

// ==========================================
// 1. SCHEMAS DA EVOLUTION API (WEBHOOK INBOUND)
// ==========================================

export const evolutionMessageKeySchema = z.object({
  remoteJid: z.string().min(1, 'remoteJid é obrigatório'),
  fromMe: z.boolean().optional().default(false),
  id: z.string().min(1, 'ID da mensagem é obrigatório'),
  participant: z.string().optional().nullable(),
  addressingMode: z.string().optional(),
});

export const evolutionAudioMessageSchema = z
  .object({
    url: z.string().nullable().optional(),
    mimetype: z.string().nullable().optional(),
    seconds: z.union([z.number(), z.string()]).nullable().optional(),
    caption: z.string().nullable().optional(),
    ptt: z.boolean().nullable().optional(),
    base64: z.string().nullable().optional(),
    directPath: z.string().nullable().optional(),
    mediaKey: z.string().nullable().optional(),
  })
  .passthrough();

export const evolutionImageMessageSchema = z
  .object({
    url: z.string().nullable().optional(),
    mimetype: z.string().nullable().optional(),
    caption: z.string().nullable().optional(),
    base64: z.string().nullable().optional(),
    directPath: z.string().nullable().optional(),
    mediaKey: z.string().nullable().optional(),
  })
  .passthrough();

export const evolutionDocumentMessageSchema = z
  .object({
    url: z.string().nullable().optional(),
    mimetype: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    fileName: z.string().nullable().optional(),
    base64: z.string().nullable().optional(),
  })
  .passthrough();

export const evolutionExtendedTextMessageSchema = z
  .object({
    text: z.string().optional(),
    matchedText: z.string().optional(),
    canonicalUrl: z.string().optional(),
    description: z.string().optional(),
    title: z.string().optional(),
  })
  .passthrough();

export const evolutionMessageContainerSchema = z
  .object({
    conversation: z.string().nullable().optional(),
    extendedTextMessage: evolutionExtendedTextMessageSchema.nullable().optional(),
    audioMessage: evolutionAudioMessageSchema.nullable().optional(),
    pttvMessage: evolutionAudioMessageSchema.nullable().optional(),
    pttMessage: evolutionAudioMessageSchema.nullable().optional(),
    imageMessage: evolutionImageMessageSchema.nullable().optional(),
    documentMessage: evolutionDocumentMessageSchema.nullable().optional(),
    base64: z.string().nullable().optional(),
  })
  .passthrough();

export const evolutionMessageDataSchema = z
  .object({
    key: evolutionMessageKeySchema,
    pushName: z.string().optional().nullable(),
    message: evolutionMessageContainerSchema.optional().nullable(),
    messageType: z.string().optional(),
    messageTimestamp: z.union([z.number(), z.string()]).optional(),
    status: z.string().optional(),
    addressingMode: z.string().optional(),
    source: z.string().optional(),
    sender: z.string().optional(),
    participantPn: z.string().optional(),
    senderPn: z.string().optional(),
    body: z.string().optional().nullable(),
    text: z.string().optional().nullable(),
    base64: z.string().optional().nullable(),
  })
  .passthrough();

export const evolutionWebhookDataUnionSchema = z.union([
  evolutionMessageDataSchema,
  z.record(z.unknown()),
  z.string(),
]);

export const evolutionWebhookPayloadSchema = z.object({
  event: z.string().optional().default('messages.upsert'),
  instance: z.string().optional().default('wkontrol_bot'),
  data: z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
        return parsed;
      } catch {
        return val;
      }
    }
    if (Array.isArray(val) && val.length > 0) {
      return val[0];
    }
    return val;
  }, evolutionWebhookDataUnionSchema),
  destination: z.string().optional(),
  date_time: z.string().optional(),
  sender: z.string().optional(),
  server_url: z.string().optional(),
  apikey: z.string().optional(),
});

export type EvolutionWebhookPayload = z.infer<typeof evolutionWebhookPayloadSchema>;
export type EvolutionMessageData = z.infer<typeof evolutionMessageDataSchema>;

// ==========================================
// 2. CONTRATO DO JOB ENFILEIRADO NO BULLMQ / REDIS
// ==========================================

export const whatsAppMessageTypeEnum = z.enum(['text', 'audio', 'image', 'document', 'unsupported']);
export type WhatsAppMessageType = z.infer<typeof whatsAppMessageTypeEnum>;

export const whatsAppInboundJobDataSchema = z.object({
  messageId: z.string().min(1),
  instance: z.string(),
  remoteJid: z.string(),
  normalizedPhone: z
    .string()
    .regex(/^\+?[1-9]\d{9,14}$/, 'Formato telefônico inválido para E.164'),
  senderName: z.string().nullable(),
  type: whatsAppMessageTypeEnum,
  content: z.object({
    text: z.string().optional(),
    mediaUrl: z.string().nullable().optional(),
    mediaBase64: z.string().nullable().optional(),
    mimetype: z.string().nullable().optional(),
    durationSeconds: z.number().nullable().optional(),
    caption: z.string().nullable().optional(),
  }),
  mediaPayload: z.record(z.unknown()).optional(),
  timestamp: z.number(),
  receivedAt: z.string().datetime(),
});

export type WhatsAppInboundJobData = z.infer<typeof whatsAppInboundJobDataSchema>;

// ==========================================
// 3. EVOLUTION API OUTBOUND (RESPOSTA AO USUÁRIO)
// ==========================================

export const evolutionSendTextPayloadSchema = z.object({
  number: z.string().min(1, 'Número de destino é obrigatório'),
  text: z.string().min(1, 'Conteúdo da mensagem não pode ser vazio'),
  delay: z.number().int().min(0).max(5000).default(1200),
  linkPreview: z.boolean().default(false),
  quoted: z
    .object({
      key: z.object({
        id: z.string(),
      }),
    })
    .optional(),
});

export type EvolutionSendTextPayload = z.infer<typeof evolutionSendTextPayloadSchema>;

// ==========================================
// 4. VINCULAÇÃO DE CONTA (OTP)
// ==========================================

export const whatsAppOtpVerificationSchema = z.object({
  code: z
    .string()
    .trim()
    .length(6, 'O código de vinculação deve ter exatamente 6 dígitos numéricos')
    .regex(/^\d{6}$/, 'O código deve conter apenas números'),
  whatsappPhone: z
    .string()
    .regex(/^\+?[1-9]\d{9,14}$/, 'Formato E.164 inválido para o telefone'),
});

export const whatsAppOtpGenerationSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
});

export type WhatsAppOtpVerificationInput = z.infer<typeof whatsAppOtpVerificationSchema>;
export type WhatsAppOtpGenerationInput = z.infer<typeof whatsAppOtpGenerationSchema>;
