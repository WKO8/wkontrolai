/**
 * WKontrolAI — Testes Unitários e de Integração da Estratégia de Idempotência
 * Valida a deduplicação atômica de mensagens inbound via Redis 7 e BullMQ
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/webhooks/evolution/route';
import { isWhatsAppCdnUrl } from '@/lib/evolution/client';
import { NextRequest } from 'next/server';

// Criamos instância compartilhada do mock envelopada em vi.hoisted para compatibilidade com Vitest
const { mockRedis, mockEnqueuedJobs } = vi.hoisted(() => {
  class InMemoryRedisMock {
    private store = new Map<string, { value: string; expiresAt: number }>();

    async set(
      key: string,
      value: string,
      mode?: string,
      durationSeconds?: number,
      flag?: string
    ): Promise<'OK' | null> {
      const now = Date.now();
      this.cleanExpired();

      if (flag === 'NX' && this.store.has(key)) {
        return null;
      }

      const ttlMs = durationSeconds ? durationSeconds * 1000 : 86400 * 1000;
      this.store.set(key, {
        value,
        expiresAt: now + ttlMs,
      });

      return 'OK';
    }

    async get(key: string): Promise<string | null> {
      this.cleanExpired();
      const entry = this.store.get(key);
      return entry ? entry.value : null;
    }

    async del(key: string): Promise<number> {
      return this.store.delete(key) ? 1 : 0;
    }

    async ttl(key: string): Promise<number> {
      this.cleanExpired();
      const entry = this.store.get(key);
      if (!entry) return -2;
      return Math.round((entry.expiresAt - Date.now()) / 1000);
    }

    clear(): void {
      this.store.clear();
    }

    private cleanExpired(): void {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (entry.expiresAt <= now) {
          this.store.delete(key);
        }
      }
    }
  }

  return {
    mockRedis: new InMemoryRedisMock(),
    mockEnqueuedJobs: [] as unknown[],
  };
});

// Mockamos os módulos do Redis e da Fila BullMQ
vi.mock('@/lib/queue/redis', () => ({
  redis: {
    set: vi.fn((...args: [string, string, string?, number?, string?]) =>
      mockRedis.set(args[0], args[1], args[2], args[3], args[4])
    ),
    get: vi.fn((key: string) => mockRedis.get(key)),
    del: vi.fn((key: string) => mockRedis.del(key)),
  },
}));

vi.mock('@/lib/queue/whatsapp', () => ({
  enqueueWhatsAppMessage: vi.fn((jobData: unknown) => {
    mockEnqueuedJobs.push(jobData);
    return Promise.resolve({ id: 'mock-job-id' });
  }),
}));

describe('1. Deduplicação Atômica no Redis via SET NX EX', () => {
  beforeEach(() => {
    mockRedis.clear();
    mockEnqueuedJobs.length = 0;
    vi.clearAllMocks();
  });

  it('deve adquirir a chave com sucesso na primeira tentativa (SET NX EX retorna OK)', async () => {
    const messageId = 'MSG-IDEM-001';
    const key = `idemp:evo:msg:${messageId}`;

    const acquired = await mockRedis.set(key, 'PENDING', 'EX', 86400, 'NX');
    expect(acquired).toBe('OK');

    const status = await mockRedis.get(key);
    expect(status).toBe('PENDING');

    const ttl = await mockRedis.ttl(key);
    expect(ttl).toBeGreaterThan(86300);
  });

  it('deve rejeitar chave duplicada no Redis (SET NX EX retorna null)', async () => {
    const messageId = 'MSG-IDEM-002';
    const key = `idemp:evo:msg:${messageId}`;

    // Primeira tentativa: Sucesso
    const firstAttempt = await mockRedis.set(key, 'PENDING', 'EX', 86400, 'NX');
    expect(firstAttempt).toBe('OK');

    // Segunda tentativa (retry ou duplicate webhook): Bloqueio
    const duplicateAttempt = await mockRedis.set(key, 'PENDING', 'EX', 86400, 'NX');
    expect(duplicateAttempt).toBeNull();
  });

  it('deve transitar os estados do ciclo de vida: PENDING -> PROCESSING -> COMPLETED', async () => {
    const messageId = 'MSG-LIFECYCLE-123';
    const key = `idemp:evo:msg:${messageId}`;

    // 1. Webhook recebe e marca PENDING
    await mockRedis.set(key, 'PENDING', 'EX', 86400, 'NX');
    expect(await mockRedis.get(key)).toBe('PENDING');

    // 2. Worker inicia processamento
    await mockRedis.set(key, 'PROCESSING', 'EX', 86400);
    expect(await mockRedis.get(key)).toBe('PROCESSING');

    // 3. Worker conclui com sucesso
    await mockRedis.set(key, 'COMPLETED', 'EX', 86400);
    expect(await mockRedis.get(key)).toBe('COMPLETED');
  });

  it('deve transitar para FAILED em caso de falha crítica no Worker', async () => {
    const messageId = 'MSG-FAILED-999';
    const key = `idemp:evo:msg:${messageId}`;

    await mockRedis.set(key, 'PROCESSING', 'EX', 86400);
    await mockRedis.set(key, 'FAILED', 'EX', 86400);

    expect(await mockRedis.get(key)).toBe('FAILED');
  });
});

describe('2. Teste de Integração do Webhook Route (/api/webhooks/evolution)', () => {
  beforeEach(() => {
    process.env.EVOLUTION_WEBHOOK_SECRET = 'test-webhook-secret-123';
    mockRedis.clear();
    mockEnqueuedJobs.length = 0;
    vi.clearAllMocks();
  });

  function createWebhookRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3000/api/webhooks/evolution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': 'test-webhook-secret-123',
      },
      body: JSON.stringify(body),
    });
  }

  it('deve processar e enfileirar mensagem válida na primeira requisição', async () => {
    const messageId = 'MSG-WEBHOOK-101';
    const payload = {
      event: 'messages.upsert',
      instance: 'wkontrol_bot',
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
          id: messageId,
        },
        pushName: 'Carlos',
        message: {
          conversation: 'Almoço 45',
        },
        messageTimestamp: 1730000000,
      },
    };

    const req = createWebhookRequest(payload);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('enqueued');
    expect(data.messageId).toBe(messageId);
    expect(mockEnqueuedJobs).toHaveLength(1);
  });

  it('deve deduplicar imediatamente quando a mesma mensagem for reenviada', async () => {
    const messageId = 'MSG-WEBHOOK-DUPLICATE-001';
    const payload = {
      event: 'messages.upsert',
      instance: 'wkontrol_bot',
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
          id: messageId,
        },
        pushName: 'Carlos',
        message: {
          conversation: 'Gastei 50 no mercado',
        },
        messageTimestamp: 1730000000,
      },
    };

    // 1ª Requisição
    const req1 = createWebhookRequest(payload);
    const res1 = await POST(req1);
    const data1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(data1.status).toBe('enqueued');
    expect(mockEnqueuedJobs).toHaveLength(1);

    // 2ª Requisição com o mesmo messageId
    const req2 = createWebhookRequest(payload);
    const res2 = await POST(req2);
    const data2 = await res2.json();

    expect(res2.status).toBe(200);
    expect(data2.status).toBe('ok');
    expect(data2.deduplicated).toBe(true);
    expect(data2.messageId).toBe(messageId);

    // Garante que o BullMQ NÃO foi invocado uma segunda vez
    expect(mockEnqueuedJobs).toHaveLength(1);
  });

  it('deve ignorar mensagens enviadas pelo próprio bot (fromMe == true) sem tocar no Redis', async () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'wkontrol_bot',
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: true, // Enviado pelo bot
          id: 'MSG-FROM-ME-001',
        },
        message: {
          conversation: 'Confirma o lançamento?',
        },
        messageTimestamp: 1730000000,
      },
    };

    const req = createWebhookRequest(payload);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ignored');
    expect(data.reason).toBe('from_me');
    expect(mockEnqueuedJobs).toHaveLength(0);
  });

  it('deve ignorar mensagens de grupos do WhatsApp (@g.us)', async () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'wkontrol_bot',
      data: {
        key: {
          remoteJid: '12036302482939@g.us', // Grupo
          fromMe: false,
          id: 'MSG-GROUP-001',
        },
        message: {
          conversation: 'Alguém viu o relatório?',
        },
        messageTimestamp: 1730000000,
      },
    };

    const req = createWebhookRequest(payload);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ignored');
    expect(data.reason).toBe('group_message_not_supported');
    expect(mockEnqueuedJobs).toHaveLength(0);
  });

  it('deve suportar rajada concorrente de 10 requisições simultâneas com mesmo ID: apenas 1 enfileira', async () => {
    const messageId = 'MSG-CONCURRENT-BURST';
    const payload = {
      event: 'messages.upsert',
      instance: 'wkontrol_bot',
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
          id: messageId,
        },
        pushName: 'Carlos',
        message: {
          conversation: 'Abasteci 100 reais',
        },
        messageTimestamp: 1730000000,
      },
    };

    // Dispara 10 requisições paralelas
    const requests = Array.from({ length: 10 }).map(() =>
      POST(createWebhookRequest(payload)).then((res) => res.json())
    );

    const results = await Promise.all(requests);

    const enqueuedCount = results.filter((r) => r.status === 'enqueued').length;
    const deduplicatedCount = results.filter((r) => r.deduplicated === true).length;

    expect(enqueuedCount).toBe(1);
    expect(deduplicatedCount).toBe(9);
    expect(mockEnqueuedJobs).toHaveLength(1);
  });

  it('deve processar e enfileirar mensagem de áudio PTT com url null', async () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'wkontrol_bot',
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
          id: 'MSG-AUDIO-NULL-URL-01',
        },
        pushName: 'Carlos',
        messageType: 'audioMessage',
        message: {
          audioMessage: {
            url: null,
            mimetype: 'audio/ogg; codecs=opus',
            seconds: 8,
            ptt: true,
          },
        },
        messageTimestamp: 1730000000,
      },
    };

    const req = createWebhookRequest(payload);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('enqueued');
    expect(mockEnqueuedJobs).toHaveLength(1);

    const enqueued = mockEnqueuedJobs[0] as {
      type: string;
      content: { mediaUrl?: string; mimetype?: string; durationSeconds?: number };
    };
    expect(enqueued.type).toBe('audio');
    expect(enqueued.content.mediaUrl).toBeUndefined();
    expect(enqueued.content.mimetype).toBe('audio/ogg; codecs=opus');
    expect(enqueued.content.durationSeconds).toBe(8);
  });

  it('deve processar e enfileirar mensagem do tipo pttvMessage', async () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'wkontrol_bot',
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
          id: 'MSG-PTTV-VOICE-01',
        },
        pushName: 'Carlos',
        messageType: 'pttvMessage',
        message: {
          pttvMessage: {
            url: null,
            mimetype: 'audio/ogg; codecs=opus',
            seconds: 4,
          },
        },
        messageTimestamp: 1730000000,
      },
    };

    const req = createWebhookRequest(payload);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('enqueued');
    expect(mockEnqueuedJobs).toHaveLength(1);

    const enqueued = mockEnqueuedJobs[0] as {
      type: string;
      content: { mediaUrl?: string; mimetype?: string; durationSeconds?: number };
    };
    expect(enqueued.type).toBe('audio');
    expect(enqueued.content.durationSeconds).toBe(4);
  });

  it('deve processar e enfileirar mensagem de imagem com url null e caption', async () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'wkontrol_bot',
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
          id: 'MSG-IMAGE-NULL-URL-01',
        },
        pushName: 'Carlos',
        messageType: 'imageMessage',
        message: {
          imageMessage: {
            url: null,
            caption: 'Comprovante almoço 45',
            mimetype: 'image/jpeg',
          },
        },
        messageTimestamp: 1730000000,
      },
    };

    const req = createWebhookRequest(payload);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('enqueued');
    expect(mockEnqueuedJobs).toHaveLength(1);

    const enqueued = mockEnqueuedJobs[0] as {
      type: string;
      content: { mediaUrl?: string; caption?: string; mimetype?: string };
    };
    expect(enqueued.type).toBe('image');
    expect(enqueued.content.mediaUrl).toBeUndefined();
    expect(enqueued.content.caption).toBe('Comprovante almoço 45');
    expect(enqueued.content.mimetype).toBe('image/jpeg');
  });

  it('deve descartar com status 200 eventos de status DELIVERY_ACK sem nó message (caso real do log do usuário)', async () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'wkontrol_bot',
      data: {
        key: {
          remoteJid: '553197489888@s.whatsapp.net',
          remoteJidAlt: '553197489888@s.whatsapp.net',
          fromMe: false,
          id: 'AC105A87F56627C6207C60D635CD8C67',
          participant: '',
          addressingMode: 'lid',
        },
        pushName: 'Matheus 👑',
        status: 'DELIVERY_ACK',
      },
    };

    const req = createWebhookRequest(payload);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ignored');
    expect(data.reason).toBe('status_delivery_ack_without_message');
    expect(mockEnqueuedJobs).toHaveLength(0);
  });

  it('deve capturar base64 e mediaPayload quando vier embutido no webhook', async () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'wkontrol_bot',
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
          id: 'MSG-AUDIO-BASE64-01',
        },
        pushName: 'Carlos',
        messageType: 'audioMessage',
        message: {
          audioMessage: {
            url: null,
            mimetype: 'audio/ogg; codecs=opus',
            seconds: 6,
            ptt: true,
            base64: 'T2dnUwACAAAAAAAAAAA=',
            directPath: '/v/t62.7114-24/voice.enc',
            mediaKey: 'EncryptedKey123==',
          },
        },
        messageTimestamp: 1730000000,
      },
    };

    const req = createWebhookRequest(payload);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('enqueued');
    expect(mockEnqueuedJobs).toHaveLength(1);

    const enqueued = mockEnqueuedJobs[0] as {
      type: string;
      content: { mediaBase64?: string; mimetype?: string };
      mediaPayload?: Record<string, unknown>;
    };
    expect(enqueued.type).toBe('audio');
    expect(enqueued.content.mediaBase64).toBe('T2dnUwACAAAAAAAAAAA=');
    expect(enqueued.mediaPayload).toBeDefined();
    const audioPayload = (enqueued.mediaPayload?.audioMessage || enqueued.mediaPayload) as Record<string, unknown>;
    expect(audioPayload?.directPath).toBe('/v/t62.7114-24/voice.enc');
  });

  it('deve processar e enfileirar mensagem de áudio quando vier no container pttMessage com base64', async () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'wkontrol_bot',
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
          id: 'MSG-PTT-MESSAGE-01',
        },
        pushName: 'Carlos',
        messageType: 'pttMessage',
        message: {
          pttMessage: {
            url: null,
            mimetype: 'audio/ogg; codecs=opus',
            seconds: 5,
            ptt: true,
            base64: 'T2dnUwACAAAAAAAAAAA=',
            directPath: '/v/t62.7114-24/ptt.enc',
          },
        },
        messageTimestamp: 1730000000,
      },
    };

    const req = createWebhookRequest(payload);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('enqueued');
    expect(mockEnqueuedJobs).toHaveLength(1);

    const enqueued = mockEnqueuedJobs[0] as {
      type: string;
      content: { mediaBase64?: string; durationSeconds?: number };
      mediaPayload?: Record<string, unknown>;
    };
    expect(enqueued.type).toBe('audio');
    expect(enqueued.content.mediaBase64).toBe('T2dnUwACAAAAAAAAAAA=');
    expect(enqueued.content.durationSeconds).toBe(5);
    const pttPayload = (enqueued.mediaPayload?.audioMessage || enqueued.mediaPayload) as Record<string, unknown>;
    expect(pttPayload?.directPath).toBe('/v/t62.7114-24/ptt.enc');
  });

  it('deve processar e enfileirar mensagem de imagem com base64 direto e caption null', async () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'wkontrol_bot',
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
          id: 'MSG-IMAGE-BASE64-NOCAPTION',
        },
        pushName: 'Carlos',
        messageType: 'imageMessage',
        message: {
          imageMessage: {
            url: null,
            caption: null,
            mimetype: 'image/jpeg',
            base64: '/9j/4AAQSkZJRgABAQEASABIAAD/',
            directPath: '/v/t62.7114-24/receipt.enc',
            mediaKey: 'ReceiptKey456==',
          },
        },
        messageTimestamp: 1730000000,
      },
    };

    const req = createWebhookRequest(payload);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('enqueued');
    expect(mockEnqueuedJobs).toHaveLength(1);

    const enqueued = mockEnqueuedJobs[0] as {
      type: string;
      content: { mediaBase64?: string; caption?: string; mimetype?: string };
      mediaPayload?: Record<string, unknown>;
    };
    expect(enqueued.type).toBe('image');
    expect(enqueued.content.mediaBase64).toBe('/9j/4AAQSkZJRgABAQEASABIAAD/');
    expect(enqueued.content.caption).toBeUndefined();
    const imgPayload = (enqueued.mediaPayload?.imageMessage || enqueued.mediaPayload) as Record<string, unknown>;
    expect(imgPayload?.mediaKey).toBe('ReceiptKey456==');
  });

  it('deve descartar com status 200 outros acks como READ e PLAYED sem nó message', async () => {
    const acks = ['READ', 'PLAYED', 'SENT', 'SERVER_ACK', 'USER_ACK'];
    for (const ack of acks) {
      const payload = {
        event: 'messages.upsert',
        instance: 'wkontrol_bot',
        data: {
          key: {
            remoteJid: '553197489888@s.whatsapp.net',
            fromMe: false,
            id: `ACK-TEST-${ack}`,
          },
          status: ack,
        },
      };

      const req = createWebhookRequest(payload);
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ignored');
      expect(data.reason).toBe(`status_${ack.toLowerCase()}_without_message`);
    }
    expect(mockEnqueuedJobs).toHaveLength(0);
  });

  it('isWhatsAppCdnUrl: deve identificar URLs da CDN do WhatsApp como criptografadas para evitar download direto', () => {
    expect(isWhatsAppCdnUrl('https://mmg.whatsapp.net/v/t62.7114-24/audio.enc')).toBe(true);
    expect(isWhatsAppCdnUrl('https://media.whatsapp.net/v/t62.7114-24/image.jpg')).toBe(true);
    expect(isWhatsAppCdnUrl('https://pps.whatsapp.net/v/photo.jpg')).toBe(true);
    expect(isWhatsAppCdnUrl('https://scontent.whatsapp.net/v/t62/audio.ogg')).toBe(true);
    expect(isWhatsAppCdnUrl('https://s3.amazonaws.com/my-bucket/audio.ogg')).toBe(false);
    expect(isWhatsAppCdnUrl('https://storage.googleapis.com/audio.ogg')).toBe(false);
  });
});
