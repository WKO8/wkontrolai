/**
 * WKontrolAI — Evolution API Webhook Route Handler
 * Endpoint de alta performance para ingestão, autenticação e deduplicação de mensagens inbound
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { redis } from '@/lib/queue/redis';
import { enqueueWhatsAppMessage } from '@/lib/queue/whatsapp';
import {
  evolutionWebhookPayloadSchema,
  whatsAppInboundJobDataSchema,
  type WhatsAppMessageType,
} from '@/lib/validations/webhook';
import { normalizeBrazilianPhoneToE164 } from '@/lib/utils/phone';

export const dynamic = 'force-dynamic';

/**
 * Compara duas strings com segurança contra timing attacks
 */
function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validação de autenticidade da origem do webhook
 * Suporta EVOLUTION_WEBHOOK_SECRET e EVOLUTION_API_KEY via:
 * 1. Query Params (?token=, ?apikey=, ?apiKey=, ?secret=)
 * 2. Headers HTTP (apikey, x-api-key, x-webhook-secret, Authorization Bearer)
 * 3. Payload Body (body.apikey enviado nativamente pela Evolution API v2)
 */
function isValidWebhookSignature(req: NextRequest, rawBody?: Record<string, unknown> | null): boolean {
  const secrets = [
    process.env.EVOLUTION_WEBHOOK_SECRET,
    process.env.EVOLUTION_API_KEY,
  ].filter(Boolean) as string[];

  if (secrets.length === 0) {
    console.error('[Evolution Webhook] Nenhuma chave configurada para validação de webhook');
    return false;
  }

  // 1. Checa query params (?token=, ?apikey=, ?apiKey=, ?secret=)
  const tokenParam =
    req.nextUrl.searchParams.get('token') ||
    req.nextUrl.searchParams.get('apikey') ||
    req.nextUrl.searchParams.get('apiKey') ||
    req.nextUrl.searchParams.get('secret');

  if (tokenParam) {
    for (const secret of secrets) {
      if (timingSafeCompare(tokenParam, secret)) return true;
    }
  }

  // 2. Checa headers (apikey, x-api-key, x-webhook-secret ou Authorization Bearer)
  const authHeader =
    req.headers.get('apikey') ||
    req.headers.get('x-api-key') ||
    req.headers.get('x-webhook-secret') ||
    req.headers.get('authorization');

  if (authHeader) {
    const cleanHeader = authHeader.replace(/^Bearer\s+/i, '').trim().replace(/^["']|["']$/g, '');
    for (const secret of secrets) {
      if (timingSafeCompare(cleanHeader, secret)) return true;
    }
  }

  // 3. Checa corpo da requisição (payload.apikey enviado pela Evolution API v2)
  if (rawBody && typeof rawBody.apikey === 'string' && rawBody.apikey) {
    for (const secret of secrets) {
      if (timingSafeCompare(rawBody.apikey, secret)) return true;
    }
  }

  console.warn(
    '[Evolution Webhook 401] Não autorizado. Query Token:',
    tokenParam ? '[PRESENT]' : '[NONE]',
    'Auth Header:',
    authHeader ? '[PRESENT]' : '[NONE]',
    'Body Apikey:',
    rawBody?.apikey ? '[PRESENT]' : '[NONE]'
  );
  return false;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startTime = performance.now();

  try {
    let rawBody: Record<string, unknown> | null = null;
    try {
      rawBody = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: 'Corpo da requisição não é um JSON válido' },
        { status: 400 }
      );
    }

    // 0. Autenticação mandatória da requisição do webhook (query, header ou body)
    if (!isValidWebhookSignature(req, rawBody)) {
      return NextResponse.json(
        { error: 'Unauthorized webhook source' },
        { status: 401 }
      );
    }

    // 0.1 Tratamento e descarte gracioso de eventos que não sejam de mensagens recebidas
    const eventName = String(rawBody?.event || '').toUpperCase();
    const isMessageUpsert =
      !eventName ||
      eventName === 'MESSAGES_UPSERT' ||
      eventName === 'MESSAGES.UPSERT' ||
      (eventName.includes('MESSAGE') &&
        (eventName.includes('UPSERT') || eventName.includes('RECEIVE')));

    if (eventName && !isMessageUpsert) {
      return NextResponse.json(
        { status: 'ignored', reason: `event_${rawBody?.event}_not_supported` },
        { status: 200 }
      );
    }

    // 0.2 Normalização preliminar e descarte imediato de eventos de status / ACK no topo
    let rawDataCandidate = rawBody?.data;
    if (typeof rawDataCandidate === 'string') {
      try {
        rawDataCandidate = JSON.parse(rawDataCandidate);
      } catch {
        // ignora
      }
    }
    if (Array.isArray(rawDataCandidate) && rawDataCandidate.length > 0) {
      rawDataCandidate = rawDataCandidate[0];
    }
    if (!rawDataCandidate && Array.isArray((rawBody as Record<string, unknown>)?.messages)) {
      const messagesArray = (rawBody as Record<string, unknown>).messages as unknown[];
      rawDataCandidate = messagesArray[0];
    }

    if (!rawDataCandidate || typeof rawDataCandidate !== 'object') {
      return NextResponse.json(
        { status: 'ignored', reason: 'empty_data' },
        { status: 200 }
      );
    }

    const preliminaryDataObj = rawDataCandidate as Record<string, unknown>;
    const rawStatus = String(preliminaryDataObj?.status || preliminaryDataObj?.messageStatus || rawBody?.status || '').toUpperCase();
    const hasMessageNode =
      preliminaryDataObj?.message &&
      typeof preliminaryDataObj.message === 'object' &&
      Object.keys(preliminaryDataObj.message as Record<string, unknown>).length > 0;

    const isAckStatus =
      rawStatus === 'DELIVERY_ACK' ||
      rawStatus === 'READ' ||
      rawStatus === 'PLAYED' ||
      rawStatus === 'PENDING' ||
      rawStatus === 'SENT' ||
      rawStatus === 'SERVER_ACK' ||
      rawStatus === 'USER_ACK';

    // Descarte gracioso de confirmações de entrega/leitura ANTES do parsing de schema
    if (isAckStatus && !hasMessageNode) {
      return NextResponse.json(
        { status: 'ignored', reason: `status_${rawStatus.toLowerCase()}_without_message` },
        { status: 200 }
      );
    }

    const normalizedPayload = {
      ...rawBody,
      data: rawDataCandidate,
    };

    // 1. Validação estrutural do webhook via Zod resiliente
    const parseResult = evolutionWebhookPayloadSchema.safeParse(normalizedPayload);
    if (!parseResult.success) {
      console.warn(
        '[Evolution Webhook Parse Failed]:',
        JSON.stringify(parseResult.error.flatten()),
        'Raw Body:',
        JSON.stringify(rawBody).slice(0, 300)
      );
      return NextResponse.json(
        {
          error: 'Payload do webhook da Evolution API inválido',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const payload = parseResult.data;

    const dataObj = (
      typeof payload.data === 'string'
        ? (() => {
            try {
              return JSON.parse(payload.data);
            } catch {
              return {};
            }
          })()
        : typeof payload.data === 'object' && payload.data !== null
          ? payload.data
          : {}
    ) as Record<string, unknown>;

    const keyObj = (
      typeof dataObj.key === 'object' && dataObj.key !== null
        ? dataObj.key
        : {}
    ) as Record<string, unknown>;

    // 2. Ignora mensagens enviadas pelo próprio bot ou sem dados de mensagem
    if (keyObj.fromMe) {
      return NextResponse.json(
        { status: 'ignored', reason: 'from_me' },
        { status: 200 }
      );
    }

    // Ignora mensagens de grupos (@g.us) no fluxo de chat 1:1
    if (typeof keyObj.remoteJid === 'string' && keyObj.remoteJid.endsWith('@g.us')) {
      return NextResponse.json(
        { status: 'ignored', reason: 'group_message_not_supported' },
        { status: 200 }
      );
    }

    const messageId = typeof keyObj.id === 'string' ? keyObj.id : undefined;
    if (!messageId) {
      return NextResponse.json(
        { status: 'ignored', reason: 'no_message_id_or_ack' },
        { status: 200 }
      );
    }

    // 3. Deduplicação atômica no Redis via SET NX EX (86400s = 24h)
    const idempotencyKey = `idemp:evo:msg:${messageId}`;
    const acquired = await redis.set(idempotencyKey, 'PENDING', 'EX', 86400, 'NX');

    if (!acquired) {
      // Mensagem já enfileirada ou em processamento — idempotência garantida
      return NextResponse.json(
        { status: 'ok', deduplicated: true, messageId },
        { status: 200 }
      );
    }

    // 4. Normalização do número de telefone para E.164 (+55DD9XXXXXXXX)
    // Suporte a WhatsApp LID (addressingMode: "lid" ou remoteJid terminado em @lid)
    const isLidMode =
      dataObj.addressingMode === 'lid' ||
      keyObj.addressingMode === 'lid' ||
      (typeof keyObj.remoteJid === 'string' && keyObj.remoteJid.endsWith('@lid'));

    const candidatePhone =
      (isLidMode
        ? (dataObj.sender as string) ||
          (dataObj.senderPn as string) ||
          (dataObj.participantPn as string) ||
          (keyObj.participant as string)
        : null) || (keyObj.remoteJid as string) || '';

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeBrazilianPhoneToE164(candidatePhone);
    } catch {
      const rawPhone = String(candidatePhone).split('@')[0].split(':')[0];
      normalizedPhone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;
    }

    // 5. Mapeamento do tipo de mensagem e extração do conteúdo
    // Desempacota recursivamente mensagens efêmeras, view-once, ou editadas
    let messageContainer: Record<string, unknown> | null | undefined =
      (typeof dataObj.message === 'object' && dataObj.message !== null
        ? dataObj.message
        : undefined) as Record<string, unknown> | undefined;

    while (
      messageContainer &&
      (messageContainer.ephemeralMessage ||
        messageContainer.viewOnceMessage ||
        messageContainer.viewOnceMessageV2 ||
        messageContainer.documentWithCaptionMessage ||
        messageContainer.editedMessage)
    ) {
      const ephemeral = messageContainer.ephemeralMessage as Record<string, unknown> | undefined;
      const viewOnce = messageContainer.viewOnceMessage as Record<string, unknown> | undefined;
      const viewOnceV2 = messageContainer.viewOnceMessageV2 as Record<string, unknown> | undefined;
      const docWithCaption = messageContainer.documentWithCaptionMessage as Record<string, unknown> | undefined;
      const edited = messageContainer.editedMessage as Record<string, unknown> | undefined;
      const editedMessage = edited?.message as Record<string, unknown> | undefined;
      const protocolMessage = editedMessage?.protocolMessage as Record<string, unknown> | undefined;

      const inner =
        ephemeral?.message ||
        viewOnce?.message ||
        viewOnceV2?.message ||
        docWithCaption?.message ||
        protocolMessage?.editedMessage;

      if (inner && typeof inner === 'object') {
        messageContainer = inner as Record<string, unknown>;
      } else {
        break;
      }
    }

    let messageType: WhatsAppMessageType = 'unsupported';
    const content: {
      text?: string;
      mediaUrl?: string;
      mediaBase64?: string;
      mimetype?: string;
      durationSeconds?: number;
      caption?: string;
    } = {};

    let mediaPayload: Record<string, unknown> | undefined;

    const rawMessageType = typeof dataObj.messageType === 'string' ? dataObj.messageType : undefined;

    const conversationText =
      typeof messageContainer?.conversation === 'string' ? messageContainer.conversation : undefined;
    const extendedText =
      typeof (messageContainer?.extendedTextMessage as Record<string, unknown>)?.text === 'string'
        ? ((messageContainer?.extendedTextMessage as Record<string, unknown>).text as string)
        : undefined;
    const topLevelBody =
      typeof dataObj.body === 'string'
        ? (dataObj.body as string)
        : typeof dataObj.text === 'string'
          ? (dataObj.text as string)
          : undefined;

    const audioObj = (messageContainer?.audioMessage ||
      messageContainer?.pttvMessage ||
      messageContainer?.pttMessage ||
      (rawMessageType === 'audioMessage' || rawMessageType === 'pttvMessage' || rawMessageType === 'pttMessage'
        ? (messageContainer?.audioMessage as Record<string, unknown> | undefined) ||
          (messageContainer?.pttvMessage as Record<string, unknown> | undefined) ||
          (messageContainer?.pttMessage as Record<string, unknown> | undefined) ||
          messageContainer
        : undefined)) as Record<string, unknown> | undefined;

    const imageObj = (messageContainer?.imageMessage ||
      (rawMessageType === 'imageMessage'
        ? (messageContainer?.imageMessage as Record<string, unknown> | undefined) || messageContainer
        : undefined)) as Record<string, unknown> | undefined;

    const documentObj = (messageContainer?.documentMessage ||
      (rawMessageType === 'documentMessage'
        ? (messageContainer?.documentMessage as Record<string, unknown> | undefined) || messageContainer
        : undefined)) as Record<string, unknown> | undefined;

    const extractBase64 = (obj?: Record<string, unknown>): string | undefined => {
      if (typeof obj?.base64 === 'string' && obj.base64.trim().length > 0) {
        return obj.base64.trim();
      }
      if (typeof dataObj.base64 === 'string' && dataObj.base64.trim().length > 0) {
        return dataObj.base64.trim();
      }
      if (
        messageContainer &&
        typeof messageContainer.base64 === 'string' &&
        messageContainer.base64.trim().length > 0
      ) {
        return messageContainer.base64.trim();
      }
      return undefined;
    };

    if (audioObj || rawMessageType === 'audioMessage' || rawMessageType === 'pttvMessage' || rawMessageType === 'pttMessage') {
      messageType = 'audio';
      content.mediaUrl =
        typeof audioObj?.url === 'string' && audioObj.url.startsWith('http')
          ? audioObj.url
          : undefined;
      content.mediaBase64 = extractBase64(audioObj);
      content.mimetype = (audioObj?.mimetype as string) || 'audio/ogg; codecs=opus';
      const sec = audioObj?.seconds;
      content.durationSeconds =
        typeof sec === 'number'
          ? sec
          : typeof sec === 'string'
            ? parseInt(sec, 10) || undefined
            : undefined;
      mediaPayload = {
        audioMessage:
          audioObj || (messageContainer?.audioMessage as Record<string, unknown> | undefined) || messageContainer,
      };
    } else if (imageObj || rawMessageType === 'imageMessage') {
      messageType = 'image';
      content.mediaUrl =
        typeof imageObj?.url === 'string' && imageObj.url.startsWith('http')
          ? imageObj.url
          : undefined;
      content.mediaBase64 = extractBase64(imageObj);
      content.mimetype = (imageObj?.mimetype as string) || 'image/jpeg';
      content.caption =
        typeof imageObj?.caption === 'string'
          ? imageObj.caption
          : topLevelBody && topLevelBody.trim()
            ? topLevelBody.trim()
            : undefined;
      mediaPayload = {
        imageMessage:
          imageObj || (messageContainer?.imageMessage as Record<string, unknown> | undefined) || messageContainer,
      };
    } else if (documentObj || rawMessageType === 'documentMessage') {
      messageType = 'document';
      content.mediaUrl =
        typeof documentObj?.url === 'string' && documentObj.url.startsWith('http')
          ? documentObj.url
          : undefined;
      content.mediaBase64 = extractBase64(documentObj);
      content.mimetype = documentObj?.mimetype as string | undefined;
      content.caption =
        (documentObj?.title as string | undefined) ||
        (documentObj?.fileName as string | undefined) ||
        undefined;
      mediaPayload = {
        documentMessage:
          documentObj || (messageContainer?.documentMessage as Record<string, unknown> | undefined) || messageContainer,
      };
    } else if (conversationText && conversationText.trim()) {
      messageType = 'text';
      content.text = conversationText.trim();
    } else if (extendedText && extendedText.trim()) {
      messageType = 'text';
      content.text = extendedText.trim();
    } else if (topLevelBody && topLevelBody.trim()) {
      messageType = 'text';
      content.text = topLevelBody.trim();
    }

    // 6. Montagem do payload tipado do Job BullMQ
    const rawTimestamp = dataObj.messageTimestamp || (payload as Record<string, unknown>).date_time;
    const timestampNumber =
      typeof rawTimestamp === 'string'
        ? parseInt(rawTimestamp, 10) || Math.floor(Date.now() / 1000)
        : typeof rawTimestamp === 'number'
          ? rawTimestamp
          : Math.floor(Date.now() / 1000);

    const instanceName =
      payload.instance ||
      (typeof rawBody?.instance === 'string' ? rawBody.instance : '') ||
      process.env.EVOLUTION_INSTANCE_NAME ||
      'wkontrol_bot';

    const jobData = whatsAppInboundJobDataSchema.parse({
      messageId,
      instance: instanceName,
      remoteJid: (keyObj.remoteJid as string) || '',
      normalizedPhone,
      senderName: (dataObj.pushName as string | null) ?? null,
      type: messageType,
      content,
      mediaPayload,
      timestamp: timestampNumber,
      receivedAt: new Date().toISOString(),
    });

    // 7. Enfileiramento assíncrono na fila BullMQ
    await enqueueWhatsAppMessage(jobData);

    console.log(
      `[Evolution Webhook Inbound]: Enqueued ${messageType} message #${messageId} from ${normalizedPhone}`
    );

    const elapsedMs = Math.round(performance.now() - startTime);

    return NextResponse.json(
      {
        status: 'enqueued',
        messageId,
        elapsedMs,
      },
      {
        status: 200,
        headers: {
          'X-Response-Time-Ms': elapsedMs.toString(),
        },
      }
    );
  } catch (error) {
    console.error('[Evolution Webhook Route Error]:', error);
    return NextResponse.json(
      {
        error: 'Erro interno ao processar webhook',
      },
      { status: 500 }
    );
  }
}
