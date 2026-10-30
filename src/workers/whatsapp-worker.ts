/**
 * WKontrolAI — BullMQ WhatsApp Inbound Background Worker
 * Processador assíncrono de mensagens inbound (Texto, Áudio e Imagens de Comprovantes)
 */

import 'dotenv/config';
import { Worker, type Job } from 'bullmq';
import { and, eq, desc, gt, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { redis } from '@/lib/queue/redis';
import { WHATSAPP_INBOUND_QUEUE_NAME } from '@/lib/queue/whatsapp';
import { evolutionApi } from '@/lib/evolution/client';
import { groq } from '@/lib/ai/groq';
import { deepseek } from '@/lib/ai/deepseek';
import { jev } from '@/lib/ai/jev';
import { extractOtpCode } from '@/lib/validations/auth';
import type { WhatsAppInboundJobData } from '@/lib/validations/webhook';
import type {
  PaymentMethod,
  SourceChannel,
  TransactionType,
} from '@/types';
import type { ParsedConfirmationIntent } from '@/lib/validations/transaction';

export const FAST_CONFIRM_REGEX =
  /^(?:1\b|\[1\]|btn_confirm\b|sim\b|s\b|ok\b|confirmo\b|confirmar\b|confirmado\b|pode\b|pode salvar\b|salva\b|salvar\b|isso\b|exato\b|positivo\b|correto\b|beleza\b|blz\b|bora\b)|^(?:👍|✅|✔️|👌)/iu;

export const FAST_CANCEL_REGEX =
  /^(?:3\b|\[3\]|btn_cancel\b|não\b|nao\b|n\b|cancela\b|cancelar\b|cancelado\b|descarta\b|descartar\b|descartado\b|esquece\b|esqueça\b|ignora\b|ignorar\b|para\b|parar\b|deixa quieto\b|apaga\b|apagar\b)|^(?:❌|🚫|⛔|🗑️)/iu;

interface ExtractedDataPayload {
  hasFinancialIntent: boolean;
  missingInformation: string | null;
  transactions: Array<{
    amount: number;
    type: TransactionType;
    suggestedCategory: string;
    paymentMethod: PaymentMethod;
    description: string;
    transactionDate: string;
    confidenceScore?: number;
  }>;
}

/**
 * Formata um valor numérico para a moeda brasileira (ex: R$ 45,50)
 */
export function formatBrlCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Traduz métodos de pagamento para rótulos em português
 */
export function formatPaymentMethodLabel(method: PaymentMethod): string {
  const map: Record<PaymentMethod, string> = {
    PIX: 'Pix',
    CREDIT_CARD: 'Cartão de Crédito',
    DEBIT_CARD: 'Cartão de Débito',
    CASH: 'Dinheiro',
    BANK_TRANSFER: 'Transferência Bancária',
    OTHER: 'Outro',
  };
  return map[method] || 'Outro';
}

/**
 * Traduz tipo de transação para rótulo em português
 */
export function formatTransactionTypeLabel(type: TransactionType): string {
  return type === 'EXPENSE' ? 'Despesa' : 'Receita';
}

/**
 * Função principal de processamento de um job inbound do WhatsApp
 */
export async function processWhatsAppInboundJob(
  job: Job<WhatsAppInboundJobData>
): Promise<void> {
  const { normalizedPhone, messageId, type: messageType, content } = job.data;

  // 0. Trava distribuída (Redis Mutex Lock) per-phone para prevenir Race Conditions
  const userLockKey = `lock:whatsapp:user:${normalizedPhone}`;
  const lockAcquired = await redis.set(userLockKey, messageId, 'PX', 10000, 'NX');

  if (!lockAcquired) {
    try {
      await job.moveToDelayed(Date.now() + 1500, job.token);
      return;
    } catch {
      throw new Error(`Concorrência detectada para ${normalizedPhone}. Reagendando job...`);
    }
  }

  // Atualiza status no Redis para PROCESSING
  await redis.set(`idemp:evo:msg:${messageId}`, 'PROCESSING', 'EX', 86400);

  try {
    // 1. Busca usuário pelo telefone E.164 no Postgres
    const [user] = await db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.whatsappPhone, normalizedPhone),
          eq(schema.users.status, 'ACTIVE')
        )
      )
      .limit(1);

    const incomingText = (content.text || '').trim();
    // Suporta com máxima flexibilidade: VINCULAR 123456, VINCULAR [123456], [123456], 123456, etc.
    const otpCode = extractOtpCode(incomingText);

    console.log(
      `[WhatsApp Worker] Mensagem recebida de ${normalizedPhone} (tipo: ${messageType}): "${incomingText.slice(0, 100)}" | OTP extraído: ${otpCode || 'nenhum'}`
    );

    // 2. Se o texto contiver o código de vinculação OU usuário não tiver WhatsApp verificado
    if (otpCode || !user || !user.whatsappVerifiedAt) {
      if (otpCode) {
        const code = otpCode;

        // Rate limiting por telefone para mitigar ataques de força bruta
        const attemptsKey = `otp:attempts:${normalizedPhone}`;
        const currentAttempts = await redis.incr(attemptsKey);
        if (currentAttempts === 1) {
          await redis.expire(attemptsKey, 3600); // Janela de 1 hora
        }

        if (currentAttempts > 5) {
          await evolutionApi.sendTextMessage(
            normalizedPhone,
            '⚠️ Limite de tentativas excedido. Por favor, aguarde 1 hora antes de tentar vincular novamente.'
          );
          await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
          return;
        }

        // Busca direta e atômica por chave no Redis, SEM redis.keys()
        const otpRaw = await redis.get(`otp:code:${code}`);

        if (otpRaw) {
          const otpData = JSON.parse(otpRaw) as {
            userId: string;
            tenantId?: string;
            phone?: string;
          };

          // Vincula o telefone ao usuário no PostgreSQL com data de verificação
          await db
            .update(schema.users)
            .set({
              whatsappPhone: normalizedPhone,
              whatsappVerifiedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(schema.users.id, otpData.userId));

          // Limpeza atômica do OTP, chaves reversas e do contador de tentativas
          await redis.del(`otp:code:${code}`);
          await redis.del(`otp:whatsapp:${otpData.userId}`);
          await redis.del(`otp:phone:${normalizedPhone}`);
          if (otpData.phone) {
            await redis.del(`otp:phone:${otpData.phone}`);
          }
          await redis.del(attemptsKey);

          // Auditoria
          await db.insert(schema.auditLogs).values({
            userId: otpData.userId,
            tenantId: otpData.tenantId || null,
            action: 'WHATSAPP_LINKED',
            entityType: 'USER',
            entityId: otpData.userId,
            metadata: { phone: normalizedPhone },
          });

          await evolutionApi.sendTextMessage(
            normalizedPhone,
            '🎉 Conta vinculada com sucesso! Bem-vindo ao WKontrolAI.\nVocê já pode mandar textos, áudios ou fotos de comprovantes para registrar seus gastos e receitas.'
          );
          await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
          return;
        } else {
          await evolutionApi.sendTextMessage(
            normalizedPhone,
            '⚠️ Este código de vinculação expirou ou é inválido. Por favor, gere um novo código no Dashboard PWA.'
          );
          await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
          return;
        }
      }

      // Se o usuário digitou "VINCULAR" sem o código numérico de 6 dígitos
      const isVincularWithoutCode = /^vincular\b/i.test(incomingText.replace(/[*_~`]/g, '').trim());
      if (isVincularWithoutCode) {
        await evolutionApi.sendTextMessage(
          normalizedPhone,
          '⚠️ Por favor, envie o comando acompanhado do seu código de 6 dígitos gerado no Dashboard.\nExemplo: *VINCULAR 123456*'
        );
        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
        return;
      }

      // Se não é OTP e número não está pareado: envia boas-vindas informativas
      await evolutionApi.sendTextMessage(
        normalizedPhone,
        `Olá! Não encontrei uma conta vinculada a este número de WhatsApp.\nAcesse ${process.env.NEXT_PUBLIC_APP_URL || 'https://app.exemplo.com'} para criar sua conta gratuita e parear seu número.`
      );
      await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
      return;
    }

    // 3. Localiza ou instancia o Tenant associado ao usuário
    let [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id))
      .limit(1);

    if (!tenant) {
      const [newTenant] = await db
        .insert(schema.tenants)
        .values({
          ownerId: user.id,
          name: `Workspace ${user.name}`,
          plan: 'BETA',
        })
        .returning();
      tenant = newTenant;
    }

    // Garante categorias padrão no tenant
    const defaultCategories: Array<{ name: string; type: TransactionType }> = [
      { name: 'Alimentação', type: 'EXPENSE' },
      { name: 'Moradia', type: 'EXPENSE' },
      { name: 'Transporte', type: 'EXPENSE' },
      { name: 'Lazer', type: 'EXPENSE' },
      { name: 'Saúde', type: 'EXPENSE' },
      { name: 'Salário', type: 'INCOME' },
      { name: 'Serviços', type: 'INCOME' },
      { name: 'Outros', type: 'EXPENSE' },
      { name: 'Outras Receitas', type: 'INCOME' },
    ];

    let currentCategories = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.tenantId, tenant.id));

    if (currentCategories.length === 0) {
      await db.insert(schema.categories).values(
        defaultCategories.map((c) => ({
          tenantId: tenant.id,
          name: c.name,
          type: c.type,
          isDefault: true,
        }))
      );
      currentCategories = await db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.tenantId, tenant.id));
    }

    // 4. Pré-processamento de Áudio e Normalização do Texto Inbound
    // O download e transcrição do áudio (Groq Whisper) ocorrem ANTES da checagem de pendências ativas,
    // disponibilizando a transcrição em rawText caso o usuário tenha respondido por voz ("Sim", "Não", "Muda pra 50").
    let rawText = '';
    let sourceChannel: SourceChannel = 'WHATSAPP_TEXT';

    if (messageType === 'audio') {
      sourceChannel = 'WHATSAPP_AUDIO';
      console.log(`[WhatsApp Worker] Processando mensagem de áudio pré-pendência (messageId: ${messageId})...`);

      if (!process.env.GROQ_API_KEY) {
        console.warn('[WhatsApp Worker] GROQ_API_KEY não configurada no ambiente');
        await evolutionApi.sendTextMessage(
          normalizedPhone,
          '⚠️ O serviço de transcrição de áudio não está configurado no momento. Por favor, envie uma mensagem de texto.'
        );
        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
        return;
      }

      let audioBuffer: Buffer;
      let audioMimetype = content.mimetype || 'audio/ogg; codecs=opus';

      try {
        const downloadedAudio = await evolutionApi.downloadMedia(
          { id: messageId, remoteJid: job.data.remoteJid, fromMe: false },
          content.mediaUrl,
          content.mediaBase64,
          job.data.mediaPayload,
          audioMimetype
        );
        audioBuffer = downloadedAudio.buffer;
        audioMimetype = downloadedAudio.mimetype;
      } catch (err) {
        console.error(`[WhatsApp Worker] Erro ao obter áudio (${messageId}):`, err);
        await evolutionApi.sendTextMessage(
          normalizedPhone,
          '⚠️ Não foi possível processar o áudio enviado (arquivo muito grande ou corrompido). Por favor, envie o áudio novamente ou escreva por texto.'
        );
        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
        return;
      }

      // Inspeção de tamanho e magic numbers do buffer para validação nos logs
      const audioHexHead = audioBuffer.subarray(0, 16).toString('hex');
      const audioAsciiHead = audioBuffer.subarray(0, 16).toString('ascii').replace(/[^\x20-\x7E]/g, '.');
      const isOggHeader = audioBuffer.length >= 4 && audioBuffer.subarray(0, 4).toString('ascii') === 'OggS';
      console.log(
        `[WhatsApp Worker] Áudio carregado: ${audioBuffer.length} bytes | Magic Head: [hex: ${audioHexHead}] [ascii: ${audioAsciiHead}] | OggS detectado: ${isOggHeader} | Mime: ${audioMimetype}`
      );

      if (audioBuffer.length > 25 * 1024 * 1024) {
        await evolutionApi.sendTextMessage(
          normalizedPhone,
          '⚠️ O áudio enviado excede o limite de 25MB suportado para transcrição. Por favor, envie um áudio mais curto.'
        );
        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
        return;
      }

      let transcription;
      try {
        transcription = await groq.transcribeAudio(audioBuffer, audioMimetype);
      } catch (err) {
        console.error(`[WhatsApp Worker] Falha na transcrição Groq Whisper (${messageId}):`, err);
        await evolutionApi.sendTextMessage(
          normalizedPhone,
          '⚠️ Ocorreu uma falha temporária ao transcrever o áudio. Por favor, tente enviar novamente ou escreva por texto.'
        );
        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
        return;
      }

      rawText = transcription.text.trim();
      console.log(`[WhatsApp Worker] Transcrição concluída: "${rawText}"`);

      if (!rawText) {
        await evolutionApi.sendTextMessage(
          normalizedPhone,
          'Não consegui ouvir nada com clareza no seu áudio. Pode mandar novamente ou escrever por texto?'
        );
        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
        return;
      }

      // Auditoria de transcrição de áudio
      await db.insert(schema.auditLogs).values({
        tenantId: tenant.id,
        userId: user.id,
        action: 'AI_TRANSCRIBED',
        entityType: 'AUDIO',
        metadata: {
          durationSeconds: transcription.durationSeconds,
          latencyMs: transcription.latencyMs,
          text: rawText,
        },
      });
    } else if (messageType === 'text') {
      sourceChannel = 'WHATSAPP_TEXT';
      rawText = (content.text || '').trim();
    }

    // 5. Verifica se o usuário possui confirmação pendente ativa em pending_confirmations (com isolamento estrito de tenant)
    // Utiliza sql`${schema.pendingConfirmations.expiresAt} > NOW()` para evitar divergências de timezone entre Node e PostgreSQL
    const [pending] = await db
      .select()
      .from(schema.pendingConfirmations)
      .where(
        and(
          eq(schema.pendingConfirmations.tenantId, tenant.id),
          eq(schema.pendingConfirmations.whatsappPhone, normalizedPhone),
          sql`${schema.pendingConfirmations.expiresAt} > NOW()`
        )
      )
      .orderBy(desc(schema.pendingConfirmations.createdAt))
      .limit(1);

    console.log(
      `[WhatsApp Worker] Verificação de pendência para tenant=${tenant.id}, phone=${normalizedPhone}: ${pending ? `ID=${pending.id} (expira em ${pending.expiresAt})` : 'NENHUMA pendência ativa'}`
    );

    // Se houver confirmação pendente ativa e a mensagem NÃO for de imagem (texto ou áudio):
    if (pending && messageType !== 'image') {
      const trimmed = rawText.trim();
      console.log(`[WhatsApp Worker] Avaliando resposta para pendência ${pending.id}: "${trimmed}"`);

      const extracted = pending.extractedData as ExtractedDataPayload;
      const items = [...(extracted.transactions || [])];

      // Ações reutilizáveis de confirmação e cancelamento
      const executeConfirm = async () => {
        for (const item of items) {
          let matchedCategory =
            currentCategories.find(
              (c) =>
                c.name.toLowerCase() === item.suggestedCategory.toLowerCase() &&
                c.type === item.type
            ) ||
            currentCategories.find(
              (c) => c.name.toLowerCase() === item.suggestedCategory.toLowerCase()
            );

          if (!matchedCategory) {
            const fallbackName = item.type === 'INCOME' ? 'Outras Receitas' : 'Outros';
            matchedCategory =
              currentCategories.find((c) => c.name === fallbackName && c.type === item.type) ||
              currentCategories.find((c) => c.type === item.type) ||
              currentCategories[0];
          }

          await db.insert(schema.transactions).values({
            tenantId: tenant.id,
            userId: user.id,
            categoryId: matchedCategory.id,
            type: item.type,
            amount: item.amount.toFixed(2),
            description: item.description,
            paymentMethod: item.paymentMethod,
            transactionDate: item.transactionDate,
            sourceChannel: pending.sourceChannel,
            confirmedByUser: true,
            rawPayload: pending.rawPayload,
            metadata: {
              confirmedAt: new Date().toISOString(),
              confidenceScore: item.confidenceScore,
            },
          });

          await db.insert(schema.auditLogs).values({
            tenantId: tenant.id,
            userId: user.id,
            action: 'TRANSACTION_CREATED',
            entityType: 'TRANSACTION',
            metadata: {
              amount: item.amount,
              category: matchedCategory.name,
              type: item.type,
              sourceChannel: pending.sourceChannel,
            },
          });
        }

        await db
          .delete(schema.pendingConfirmations)
          .where(
            and(
              eq(schema.pendingConfirmations.id, pending.id),
              eq(schema.pendingConfirmations.tenantId, tenant.id)
            )
          );

        if (items.length === 1) {
          const item = items[0];
          await evolutionApi.sendTextMessage(
            normalizedPhone,
            `✅ Lançamento de ${formatBrlCurrency(item.amount)} (${item.description}) confirmado com sucesso!`
          );
        } else {
          await evolutionApi.sendTextMessage(
            normalizedPhone,
            `✅ Todos os ${items.length} lançamentos foram confirmados com sucesso!`
          );
        }

        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
      };

      const executeCancel = async () => {
        await db
          .delete(schema.pendingConfirmations)
          .where(
            and(
              eq(schema.pendingConfirmations.id, pending.id),
              eq(schema.pendingConfirmations.tenantId, tenant.id)
            )
          );

        await evolutionApi.sendTextMessage(
          normalizedPhone,
          '🗑️ Lançamento descartado com sucesso.'
        );

        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
      };

      // 5a. Fast-path determinístico local para confirmação e cancelamento
      let isConfirm = FAST_CONFIRM_REGEX.test(trimmed);
      let isCancel = !isConfirm && FAST_CANCEL_REGEX.test(trimmed);

      // Se os regexes locais não baterem, consulta Jev com fallback seguro
      if (!isConfirm && !isCancel) {
        try {
          isConfirm = await jev.isConfirmationIntent(trimmed);
        } catch (err) {
          console.warn('[WhatsApp Worker] Falha em jev.isConfirmationIntent:', err);
        }

        if (!isConfirm) {
          try {
            isCancel = await jev.isCancellationIntent(trimmed);
          } catch (err) {
            console.warn('[WhatsApp Worker] Falha em jev.isCancellationIntent:', err);
          }
        }
      }

      if (isConfirm) {
        await executeConfirm();
        return;
      }

      if (isCancel) {
        await executeCancel();
        return;
      }

      // Se o usuário clicou no botão "btn_edit" ou digitou "2" / "editar"
      if (/^(?:2\b|\[2\]|btn_edit\b|editar\b)$/i.test(trimmed)) {
        await evolutionApi.sendTextMessage(
          normalizedPhone,
          '✏️ *Como deseja editar o lançamento?*\n\nVocê pode me dizer por texto ou áudio o que quer alterar.\nExemplos:\n• _"Muda o valor para R$ 50"_\n• _"Altera a categoria para Transporte"_\n• _"Foi no Pix"_\n• _"Descrição: Almoço com cliente"_'
        );
        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
        return;
      }

      // 5b. Interpretação semântica com DeepSeek (PATCH, REMOVAL, NEW_TRANSACTION, UNKNOWN)
      let intent: ParsedConfirmationIntent;
      try {
        intent = await deepseek.parseConfirmationIntent(trimmed, items);
      } catch (err) {
        console.warn('[WhatsApp Worker] Falha ao consultar DeepSeek parseConfirmationIntent:', err);
        intent = {
          action: 'UNKNOWN',
          rawResponse: trimmed,
        };
      }

      console.log(`[WhatsApp Worker] Intent interpretado pela IA: ${intent.action}`, intent.patch);

      if (intent.action === 'CONFIRM') {
        await executeConfirm();
        return;
      }

      if (intent.action === 'CANCEL') {
        await executeCancel();
        return;
      }

      if (intent.action === 'PATCH' && intent.patch) {
        const patch = intent.patch;

        // Remoção de item específico da lista
        if (
          patch.removeItemIndex !== undefined &&
          patch.removeItemIndex >= 0 &&
          patch.removeItemIndex < items.length
        ) {
          items.splice(patch.removeItemIndex, 1);
          console.log(`[WhatsApp Worker] Item no índice ${patch.removeItemIndex} removido.`);

          if (items.length === 0) {
            await db
              .delete(schema.pendingConfirmations)
              .where(
                and(
                  eq(schema.pendingConfirmations.id, pending.id),
                  eq(schema.pendingConfirmations.tenantId, tenant.id)
                )
              );

            await evolutionApi.sendTextMessage(
              normalizedPhone,
              '🗑️ Todos os itens foram removidos. Pendência cancelada.'
            );
            await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
            return;
          }
        }

        // Atualização de campos dos itens (aplica ao item especificado ou ao primeiro item)
        const targetItem = items[0];
        if (targetItem) {
          if (patch.amount !== undefined) targetItem.amount = patch.amount;
          if (patch.type) targetItem.type = patch.type;
          if (patch.category) targetItem.suggestedCategory = patch.category;
          if (patch.payment_method) targetItem.paymentMethod = patch.payment_method;
          if (patch.description) targetItem.description = patch.description;
          if (patch.transaction_date) targetItem.transactionDate = patch.transaction_date;
        }

        // Atualiza a pendência no banco de dados
        await db
          .update(schema.pendingConfirmations)
          .set({
            extractedData: {
              ...extracted,
              transactions: items,
            },
          })
          .where(
            and(
              eq(schema.pendingConfirmations.id, pending.id),
              eq(schema.pendingConfirmations.tenantId, tenant.id)
            )
          );

        // Registro de auditoria da correção
        await db.insert(schema.auditLogs).values({
          tenantId: tenant.id,
          userId: user.id,
          action: 'AI_USER_CORRECTION',
          entityType: 'TRANSACTION',
          metadata: {
            pendingId: pending.id,
            patch: intent.patch,
            rawText: trimmed,
          },
        });

        // Envia mensagem de resposta no WhatsApp com o resumo atualizado dos itens e o prompt híbrido
        let updatedSummary = '✏️ *Lançamento atualizado!*\n\n';
        if (items.length === 1) {
          const item = items[0];
          const emoji = item.type === 'EXPENSE' ? '💸' : '💰';
          updatedSummary += `Novo resumo ${emoji}:\n`;
          updatedSummary += `• *Tipo:* ${formatTransactionTypeLabel(item.type)}\n`;
          updatedSummary += `• *Valor:* ${formatBrlCurrency(item.amount)}\n`;
          updatedSummary += `• *Categoria:* ${item.suggestedCategory}\n`;
          updatedSummary += `• *Pagamento:* ${formatPaymentMethodLabel(item.paymentMethod)}\n`;
          updatedSummary += `• *Descrição:* ${item.description}\n`;
          updatedSummary += `• *Data:* ${item.transactionDate}\n\n`;
        } else {
          updatedSummary += `Resumo atualizado (*${items.length} itens*):\n\n`;
          items.forEach((item, index) => {
            updatedSummary += `${index + 1}) *${formatTransactionTypeLabel(item.type)}*: ${formatBrlCurrency(item.amount)} — ${item.description} (${item.suggestedCategory} via ${formatPaymentMethodLabel(item.paymentMethod)})\n`;
          });
          updatedSummary += '\n';
        }

        updatedSummary += `👉 *Escolha uma opção:*\n`;
        updatedSummary += `[1] Confirmar ✅\n`;
        updatedSummary += `[2] Editar ✏️\n`;
        updatedSummary += `[3] Cancelar ❌\n\n`;
        updatedSummary += `💡 *Dica:* Responda 1, 2 ou 3 (ou fale "Sim", "Não", "Muda pra 50" por áudio ou texto).`;

        await evolutionApi.sendTextMessage(normalizedPhone, updatedSummary);

        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
        return;
      }

      // Se não for um novo lançamento (NEW_TRANSACTION), lembra o usuário sobre a pendência ativa
      if (intent.action !== 'NEW_TRANSACTION') {
        let reminderMsg = `⚠️ *Você possui um lançamento aguardando sua resposta:*\n\n`;
        if (items.length === 1) {
          const item = items[0];
          const emoji = item.type === 'EXPENSE' ? '💸' : '💰';
          reminderMsg += `• *Tipo:* ${formatTransactionTypeLabel(item.type)} ${emoji}\n`;
          reminderMsg += `• *Valor:* ${formatBrlCurrency(item.amount)}\n`;
          reminderMsg += `• *Categoria:* ${item.suggestedCategory}\n`;
          reminderMsg += `• *Pagamento:* ${formatPaymentMethodLabel(item.paymentMethod)}\n`;
          reminderMsg += `• *Descrição:* ${item.description}\n`;
          reminderMsg += `• *Data:* ${item.transactionDate}\n\n`;
        } else {
          items.forEach((item, idx) => {
            reminderMsg += `${idx + 1}) *${formatTransactionTypeLabel(item.type)}*: ${formatBrlCurrency(item.amount)} — ${item.description} (${item.suggestedCategory} via ${formatPaymentMethodLabel(item.paymentMethod)})\n`;
          });
          reminderMsg += '\n';
        }
        reminderMsg += `👉 *Escolha uma opção:*\n`;
        reminderMsg += `[1] Confirmar ✅\n`;
        reminderMsg += `[2] Editar ✏️\n`;
        reminderMsg += `[3] Cancelar ❌\n\n`;
        reminderMsg += `💡 *Dica:* Responda 1, 2 ou 3 (ou fale "Sim", "Não", "Muda pra 50" por áudio ou texto).`;

        await evolutionApi.sendTextMessage(normalizedPhone, reminderMsg);
        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
        return;
      }
      // Se intent.action === 'NEW_TRANSACTION', prossegue abaixo para extração e substituição da pendência!
    }

    // 6. Novo lançamento financeiro: Processamento multimodal (Imagem ou Texto/Áudio)
    if (messageType === 'image') {
      sourceChannel = 'WHATSAPP_IMAGE';
      console.log(`[WhatsApp Worker] Processando imagem/comprovante (messageId: ${messageId})...`);

      if (!process.env.DEEPSEEK_API_KEY) {
        console.warn('[WhatsApp Worker] DEEPSEEK_API_KEY não configurada no ambiente');
        await evolutionApi.sendTextMessage(
          normalizedPhone,
          '⚠️ O serviço de leitura de comprovantes não está configurado no momento. Por favor, envie uma mensagem de texto com os detalhes do gasto.'
        );
        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
        return;
      }

      let imageBuffer: Buffer;
      let imageMimetype = content.mimetype || 'image/jpeg';

      try {
        const downloadedImage = await evolutionApi.downloadMedia(
          { id: messageId, remoteJid: job.data.remoteJid, fromMe: false },
          content.mediaUrl,
          content.mediaBase64,
          job.data.mediaPayload,
          imageMimetype
        );
        imageBuffer = downloadedImage.buffer;
        imageMimetype = downloadedImage.mimetype;
      } catch (err) {
        console.error(`[WhatsApp Worker] Erro ao obter imagem (${messageId}):`, err);
        await evolutionApi.sendTextMessage(
          normalizedPhone,
          '⚠️ Não foi possível carregar a imagem do comprovante (arquivo muito grande ou ilegível). Por favor, envie uma foto mais nítida ou digite por texto.'
        );
        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
        return;
      }

      // Inspeção de tamanho e magic numbers do buffer para validação nos logs
      const imageHexHead = imageBuffer.subarray(0, 16).toString('hex');
      const imageAsciiHead = imageBuffer.subarray(0, 16).toString('ascii').replace(/[^\x20-\x7E]/g, '.');
      const isJpegHeader = imageBuffer.length >= 3 && imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 && imageBuffer[2] === 0xff;
      const isPngHeader = imageBuffer.length >= 4 && imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4e && imageBuffer[3] === 0x47;
      console.log(
        `[WhatsApp Worker] Imagem carregada: ${imageBuffer.length} bytes | Magic Head: [hex: ${imageHexHead}] [ascii: ${imageAsciiHead}] | É JPEG: ${isJpegHeader} | É PNG: ${isPngHeader} | Mime: ${imageMimetype}`
      );

      if (imageBuffer.length > 20 * 1024 * 1024) {
        await evolutionApi.sendTextMessage(
          normalizedPhone,
          '⚠️ A imagem enviada excede o limite de 20MB suportado para leitura. Por favor, envie uma foto menor ou mais nítida.'
        );
        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
        return;
      }

      let ocrResult;
      try {
        ocrResult = await deepseek.processReceiptImage(imageBuffer, imageMimetype);
      } catch (err) {
        console.error(`[WhatsApp Worker] Falha no processamento OCR DeepSeek (${messageId}):`, err);
        await evolutionApi.sendTextMessage(
          normalizedPhone,
          '⚠️ Não foi possível analisar este comprovante no momento. Por favor, tente enviar novamente ou digite os dados da compra.'
        );
        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
        return;
      }

      if (!ocrResult.has_financial_intent || ocrResult.transactions.length === 0) {
        const errorMsg =
          ocrResult.missing_information ||
          'Não encontrei informações de gastos ou comprovantes nessa imagem. Certifique-se de que a foto esteja nítida e bem iluminada.';
        await evolutionApi.sendTextMessage(normalizedPhone, errorMsg);
        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
        return;
      }

      // Conclui extração de imagem
      rawText = content.caption || 'Comprovante recebido por imagem';
      await handlePendingConfirmationCreation({
        tenantId: tenant.id,
        userId: user.id,
        normalizedPhone,
        sourceChannel,
        rawText,
        transactions: ocrResult.transactions,
        currentCategories,
        hasPreviousPending: !!pending,
      });

      await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
      return;
    } else if (messageType === 'text' || messageType === 'audio') {
      // Para áudio e texto, rawText já foi preenchido e transcrito
      if (!rawText || rawText.trim().length === 0) {
        await evolutionApi.sendTextMessage(
          normalizedPhone,
          'Olá! Para registrar um gasto ou receita, envie um texto, áudio ou comprovante informando o valor e o que foi comprado (ex: "Paguei 35 no almoço").'
        );
        await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
        return;
      }
    } else {
      // Tipo não suportado
      await evolutionApi.sendTextMessage(
        normalizedPhone,
        'Formato de mensagem não suportado. Por favor, envie texto, áudio ou foto de comprovante.'
      );
      await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
      return;
    }

    // 6. Extração estruturada via DeepSeek para Textos e Áudios transcritos
    if (!process.env.DEEPSEEK_API_KEY) {
      console.warn('[WhatsApp Worker] DEEPSEEK_API_KEY não configurada no ambiente');
      await evolutionApi.sendTextMessage(
        normalizedPhone,
        '⚠️ O serviço de inteligência artificial não está configurado no momento. Por favor, tente novamente mais tarde.'
      );
      await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
      return;
    }

    const extraction = await deepseek.extractTransactionFromText(rawText);

    if (!extraction.has_financial_intent) {
      if (extraction.missing_information) {
        await evolutionApi.sendTextMessage(normalizedPhone, extraction.missing_information);
      } else {
        await evolutionApi.sendTextMessage(
          normalizedPhone,
          'Olá! Para registrar um gasto ou receita, envie um texto, áudio ou comprovante informando o valor e o que foi comprado (ex: "Paguei 35 no almoço").'
        );
      }
      await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
      return;
    }

    if (extraction.transactions.length === 0) {
      const askMissing =
        extraction.missing_information || 'Entendi seu lançamento! Mas qual foi o valor gasto?';
      await evolutionApi.sendTextMessage(normalizedPhone, askMissing);
      await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
      return;
    }

    // 7. Enriquecimento e validação via Jev (Categorização e Meio de Pagamento)
    await handlePendingConfirmationCreation({
      tenantId: tenant.id,
      userId: user.id,
      normalizedPhone,
      sourceChannel,
      rawText,
      transactions: extraction.transactions,
      currentCategories,
      hasPreviousPending: !!pending,
    });

    await redis.set(`idemp:evo:msg:${messageId}`, 'COMPLETED', 'EX', 86400);
  } catch (error) {
    console.error(`[WhatsAppWorker Error in Job ${messageId}]:`, error);
    await redis.set(`idemp:evo:msg:${messageId}`, 'FAILED', 'EX', 86400);
    throw error;
  } finally {
    // Libera a trava atômica de concorrência com segurança
    try {
      const currentLockHolder = await redis.get(userLockKey);
      if (currentLockHolder === messageId) {
        await redis.del(userLockKey);
      }
    } catch (err) {
      console.error('[WhatsAppWorker Lock Release Error]:', err);
    }
  }
}

/**
 * Cria a confirmação pendente no banco e envia a mensagem interativa ao usuário
 */
async function handlePendingConfirmationCreation(params: {
  tenantId: string;
  userId: string;
  normalizedPhone: string;
  sourceChannel: SourceChannel;
  rawText: string;
  transactions: Array<{
    amount: number;
    type: TransactionType;
    suggested_category: string;
    payment_method: PaymentMethod;
    description: string;
    transaction_date: string;
    confidence_score?: number;
  }>;
  currentCategories: Array<{ id: string; name: string; type: TransactionType }>;
  hasPreviousPending: boolean;
}): Promise<void> {
  const {
    tenantId,
    userId,
    normalizedPhone,
    sourceChannel,
    rawText,
    transactions,
    currentCategories,
    hasPreviousPending,
  } = params;

  // Se já existia uma pendência anterior, remove com isolamento de tenant_id
  if (hasPreviousPending) {
    await db
      .delete(schema.pendingConfirmations)
      .where(
        and(
          eq(schema.pendingConfirmations.tenantId, tenantId),
          eq(schema.pendingConfirmations.whatsappPhone, normalizedPhone)
        )
      );
  }

  const categoryNames = currentCategories.map((c) => c.name);

  // Enriquecimento com Jev para cada transação extraída
  const enrichedTransactions = await Promise.all(
    transactions.map(async (item) => {
      let finalCategory = item.suggested_category;
      let finalPaymentMethod = item.payment_method;

      try {
        const jevCat = await jev.classifyCategory(item.description, categoryNames);
        if (jevCat.confidence >= 0.5) {
          finalCategory = jevCat.category;
        }
      } catch (err) {
        console.warn('[Jev Category Classification Error]:', err);
      }

      try {
        if (item.payment_method === 'OTHER') {
          const jevPay = await jev.classifyPaymentMethod(item.description);
          if (jevPay.confidence >= 0.6) {
            finalPaymentMethod = jevPay.paymentMethod;
          }
        }
      } catch (err) {
        console.warn('[Jev Payment Classification Error]:', err);
      }

      return {
        amount: item.amount,
        type: item.type,
        suggestedCategory: finalCategory,
        paymentMethod: finalPaymentMethod,
        description: item.description,
        transactionDate: item.transaction_date,
        confidenceScore: item.confidence_score,
      };
    })
  );

  // Salva na tabela pending_confirmations com TTL de 2 horas e isolamento estrito
  await db.insert(schema.pendingConfirmations).values({
    whatsappPhone: normalizedPhone,
    tenantId,
    userId,
    sourceChannel,
    extractedData: {
      hasFinancialIntent: true,
      missingInformation: null,
      transactions: enrichedTransactions,
    },
    rawPayload: rawText,
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 horas
  });

  // Monta a mensagem para o WhatsApp com formatação amigável e opções híbridas
  let message = '';
  if (hasPreviousPending) {
    message += '⚠️ Substituí a pendência anterior por esta nova:\n\n';
  }

  if (enrichedTransactions.length === 1) {
    const item = enrichedTransactions[0];
    const emoji = item.type === 'EXPENSE' ? '💸' : '💰';
    message += `Confirma o lançamento? ${emoji}\n\n`;
    message += `• *Tipo:* ${formatTransactionTypeLabel(item.type)}\n`;
    message += `• *Valor:* ${formatBrlCurrency(item.amount)}\n`;
    message += `• *Categoria:* ${item.suggestedCategory}\n`;
    message += `• *Pagamento:* ${formatPaymentMethodLabel(item.paymentMethod)}\n`;
    message += `• *Descrição:* ${item.description}\n`;
    message += `• *Data:* ${item.transactionDate}\n\n`;
    message += `👉 *Escolha uma opção:*\n`;
    message += `[1] Confirmar ✅\n`;
    message += `[2] Editar ✏️\n`;
    message += `[3] Cancelar ❌\n\n`;
    message += `💡 *Dica:* Responda 1, 2 ou 3 (ou fale "Sim", "Não", "Muda pra 50" por áudio ou texto).`;
  } else {
    message += `Identifiquei *${enrichedTransactions.length} lançamentos*:\n\n`;
    enrichedTransactions.forEach((item, index) => {
      message += `${index + 1}) *${formatTransactionTypeLabel(item.type)}*: ${formatBrlCurrency(item.amount)} — ${item.description} (${item.suggestedCategory} via ${formatPaymentMethodLabel(item.paymentMethod)})\n`;
    });
    message += `\n👉 *Escolha uma opção:*\n`;
    message += `[1] Confirmar Todos ✅\n`;
    message += `[2] Editar / Remover Item ✏️\n`;
    message += `[3] Cancelar Todos ❌\n\n`;
    message += `💡 *Dica:* Responda 1, 2 ou 3 (ou fale "Sim", "Não", "Muda pra 50" por áudio ou texto).`;
  }

  await evolutionApi.sendTextMessage(normalizedPhone, message);
}

/**
 * Instância e inicialização do Worker BullMQ
 */
export const whatsappWorker = new Worker<WhatsAppInboundJobData>(
  WHATSAPP_INBOUND_QUEUE_NAME,
  async (job) => {
    await processWhatsAppInboundJob(job);
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

whatsappWorker.on('ready', () => {
  console.log(`[WhatsAppWorker] Pronto e escutando a fila: ${WHATSAPP_INBOUND_QUEUE_NAME}`);
});

whatsappWorker.on('completed', (job) => {
  console.log(`[WhatsAppWorker] Job ${job.id} concluído com sucesso`);
});

whatsappWorker.on('failed', (job, err) => {
  console.error(`[WhatsAppWorker] Job ${job?.id} falhou:`, err.message);
});
