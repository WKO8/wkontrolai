/**
 * WKontrolAI — BullMQ Queue for WhatsApp Inbound Processing
 * Gerencia a fila de mensagens recebidas via Evolution API
 */

import { Queue, type Job } from 'bullmq';
import { redis } from './redis';
import type { WhatsAppInboundJobData } from '@/lib/validations/webhook';

export const WHATSAPP_INBOUND_QUEUE_NAME = 'whatsapp-inbound';

declare global {
  // eslint-disable-next-line no-var
  var __whatsapp_queue: Queue<WhatsAppInboundJobData> | undefined;
}

export function getWhatsAppInboundQueue(): Queue<WhatsAppInboundJobData> {
  if (!globalThis.__whatsapp_queue) {
    globalThis.__whatsapp_queue = new Queue<WhatsAppInboundJobData>(
      WHATSAPP_INBOUND_QUEUE_NAME,
      {
        connection: redis,
        defaultJobOptions: {
          removeOnComplete: {
            count: 1000,
            age: 86400, // 24 horas
          },
          removeOnFail: {
            count: 5000,
            age: 7 * 86400, // 7 dias
          },
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }
    );
  }
  return globalThis.__whatsapp_queue;
}

/**
 * Enfileira uma mensagem recebida no WhatsApp para processamento assíncrono.
 * Utiliza o messageId como jobId para deduplicação idempotente nativa no BullMQ.
 */
export async function enqueueWhatsAppMessage(
  payload: WhatsAppInboundJobData
): Promise<Job<WhatsAppInboundJobData>> {
  return await getWhatsAppInboundQueue().add('inbound-message', payload, {
    jobId: payload.messageId,
  });
}
