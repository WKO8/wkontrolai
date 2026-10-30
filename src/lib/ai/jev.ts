/**
 * Jev (TypeSafe AI) Client - System One Deterministic Decision Engine
 * Documentation: https://docs.typesafe.ai/introduction
 * 
 * Provides typed primitives:
 * - `noul`: Fast, high-accuracy boolean decision answering ("yes/no" intent, confirmation, cancellation)
 * - `choice`: Categorical classification into strict sets of options with confidence and probabilities
 * - `score`: Continuous scoring for anomaly detection or urgency
 */

import { PAYMENT_METHODS, type PaymentMethod } from '@/types';

export interface JevNoulResponse {
  type: 'noul';
  decision: boolean;
  confidence: number;
}

export interface JevChoiceResponse<T extends string = string> {
  type: 'choice';
  choice: T;
  confidence: number;
  probabilities: Record<T, number>;
}

export interface JevScoreResponse {
  type: 'score';
  score: number;
  confidence: number;
}

export interface JevSystemOneResponse {
  model: string;
  answers: {
    [questionKey: string]: JevNoulResponse | JevChoiceResponse | JevScoreResponse;
  };
}

const DEFAULT_CATEGORY_CRITERIA: Record<string, string> = {
  'Alimentação': 'Despesas com refeições, restaurantes, lanches, bares, supermercado, feira, padaria, coxinha, café e delivery de comida.',
  'Transporte': 'Despesas com combustível, gasolina, etanol, táxi, Uber, 99, passagens de ônibus/metrô, pedágio e estacionamento.',
  'Moradia': 'Despesas com aluguel, condomínio, IPTU, conta de luz, água, gás encanado, internet e reformas domésticas.',
  'Saúde': 'Despesas com consultas médicas, exames, dentista, remédios, farmácia, terapia e plano de saúde.',
  'Educação': 'Despesas com mensalidades escolares, faculdade, cursos, livros, treinamentos e materiais de estudo.',
  'Lazer': 'Despesas com passeios, viagens, cinema, shows, festas, jogos, assinaturas de streaming e hobbies.',
  'Salário': 'Receitas provenientes de salário, pró-labore, adiantamentos trabalhistas e gratificações.',
  'Outras Receitas': 'Recebimentos diversos de clientes, vendas pontuais, restituições e reembolsos.',
  'Investimentos': 'Receitas de dividendos, rendimentos de aplicações financeiras, fundos, ações e aportes.',
  'Outros': 'Despesas ou receitas gerais diversas que não se encaixam claramente nas categorias anteriores.',
};

const PAYMENT_METHOD_CRITERIA: Record<PaymentMethod, string> = {
  PIX: 'Pagamento instantâneo via Pix, chave Pix ou QR Code Pix.',
  CREDIT_CARD: 'Pagamento efetuado via cartão de crédito, fatura, no crédito ou parcelado.',
  DEBIT_CARD: 'Pagamento efetuado via cartão de débito à vista ou no débito.',
  CASH: 'Pagamento efetuado em dinheiro físico, notas, cédulas ou moedas.',
  BANK_TRANSFER: 'Transferência bancária convencional como TED, DOC ou depósito bancário.',
  OTHER: 'Outro método de pagamento não especificado expressamente.',
};

export const LOCAL_CONFIRM_REGEX =
  /^(?:sim|s|ok|confirmo|confirmar|confirmado|pode|pode salvar|salva|salvar|isso|exato|positivo|correto|beleza|blz|bora)\b|^(?:👍|✅|✔️|👌)/iu;

export const LOCAL_CANCEL_REGEX =
  /^(?:não|nao|n|cancela|cancelar|cancelado|esquece|esqueça|ignora|ignorar|para|parar|deixa quieto|apaga|apagar)\b|^(?:❌|🚫|⛔|🗑️)/iu;

export class JevClient {
  private readonly apiKey: string;
  private readonly baseUrl: string = 'https://api.typesafe.ai/v1/systemone';
  private readonly defaultModel: string = 'jev-latest';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TYPESAFE_API_KEY || '';
  }

  /**
   * Raw invocation of TypeSafe System One API
   */
  async ask(state: string, questions: Record<string, unknown>): Promise<JevSystemOneResponse> {
    if (!this.apiKey) {
      throw new Error('TYPESAFE_API_KEY is required to call Jev API');
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        state,
        model: this.defaultModel,
        questions,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Jev API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<JevSystemOneResponse>;
  }

  /**
   * Deterministic Boolean Intent: Does the message confirm the pending transaction?
   */
  async isConfirmationIntent(messageText: string): Promise<boolean> {
    const trimmed = (messageText || '').trim();
    if (!trimmed) return false;

    // Fast-path determinístico local
    if (LOCAL_CONFIRM_REGEX.test(trimmed)) {
      return true;
    }
    if (LOCAL_CANCEL_REGEX.test(trimmed)) {
      return false;
    }

    try {
      const result = await this.ask(trimmed, {
        is_confirm: {
          type: 'noul',
          instructions: 'Does this message confirm, approve, or agree with the pending financial transaction?',
          criteria: {
            true: 'O usuário expressa concordância, aprovação ou confirmação explícita (ex: "sim", "ok", "confirmo", "pode salvar", "positivo", emoji de joinha ou check).',
            false: 'O usuário expressa recusa, cancelamento, descarte ou trata de outro assunto.',
          },
        },
      });

      const answer = result.answers.is_confirm as JevNoulResponse | undefined;
      return !!answer?.decision;
    } catch (err) {
      console.warn('[Jev isConfirmationIntent] Falha na Jev API, utilizando fallback local:', err);
      return LOCAL_CONFIRM_REGEX.test(trimmed);
    }
  }

  /**
   * Deterministic Boolean Intent: Does the message request a cancellation?
   */
  async isCancellationIntent(messageText: string): Promise<boolean> {
    const trimmed = (messageText || '').trim();
    if (!trimmed) return false;

    // Fast-path determinístico local
    if (LOCAL_CANCEL_REGEX.test(trimmed)) {
      return true;
    }
    if (LOCAL_CONFIRM_REGEX.test(trimmed)) {
      return false;
    }

    try {
      const result = await this.ask(trimmed, {
        is_cancel: {
          type: 'noul',
          instructions: 'Does this message request to cancel, discard, ignore, or delete the pending transaction?',
          criteria: {
            true: 'O usuário expressa recusa, cancelamento, descarte ou rejeição (ex: "cancela", "esquece", "não", "para", "deixa quieto", emoji de x ou lixeira).',
            false: 'O usuário confirma, aprova ou trata de outro assunto.',
          },
        },
      });

      const answer = result.answers.is_cancel as JevNoulResponse | undefined;
      return !!answer?.decision;
    } catch (err) {
      console.warn('[Jev isCancellationIntent] Falha na Jev API, utilizando fallback local:', err);
      return LOCAL_CANCEL_REGEX.test(trimmed);
    }
  }

  /**
   * Deterministic Boolean Routing: Does this message describe a financial expense/income transaction?
   */
  async isFinancialTransaction(messageText: string): Promise<boolean> {
    const trimmed = (messageText || '').trim();
    if (!trimmed) return false;

    const fallbackCheck = () => {
      const hasNumber = /\d+/.test(trimmed);
      const hasFinancialWord =
        /(?:gastei|paguei|comprei|recebi|pix|r\$|\breais\b|\bcartao\b|\bdebito\b|\bcredito\b|\balmoco\b|\bjantar\b|\bcafe\b|\buber\b|\bmercado\b|\bposto\b|\bgasolina\b|\bfarmacia\b|\bconta\b|\bboleto\b|\btransferi\b)/i.test(
          trimmed
        );
      return hasNumber && hasFinancialWord;
    };

    try {
      const result = await this.ask(trimmed, {
        is_financial: {
          type: 'noul',
          instructions: 'Does this message report an expense, payment, purchase, income, or monetary transaction?',
          criteria: {
            true: 'O usuário relata um gasto, pagamento, compra, recebimento, receita ou movimentação monetária com valor numérico.',
            false: 'Mensagem puramente conversacional, saudação, dúvida ou sem dados financeiros.',
          },
        },
      });

      const answer = result.answers.is_financial as JevNoulResponse | undefined;
      return !!answer?.decision;
    } catch (err) {
      console.warn('[Jev isFinancialTransaction] Falha na Jev API, utilizando fallback local:', err);
      return fallbackCheck();
    }
  }

  /**
   * Categorical Choice: Select the best matching category from tenant's existing categories
   */
  async classifyCategory(
    description: string,
    availableCategories: string[]
  ): Promise<{ category: string; confidence: number }> {
    if (!availableCategories.length) {
      return { category: 'Outros', confidence: 1.0 };
    }

    const options = availableCategories.includes('Outros')
      ? availableCategories
      : [...availableCategories, 'Outros'];

    // Monta o mapa de criteria semântico obrigatório exigido pela Jev API para perguntas "choice"
    const criteria: Record<string, string> = {};
    for (const opt of options) {
      criteria[opt] = DEFAULT_CATEGORY_CRITERIA[opt] || `Despesas ou receitas financeiras relacionadas a ${opt}.`;
    }

    try {
      const result = await this.ask(description, {
        category: {
          type: 'choice',
          instructions: 'Classify this transaction description into the most accurate financial category',
          options,
          criteria,
        },
      });

      const answer = result.answers.category as JevChoiceResponse | undefined;
      if (answer?.choice && options.includes(answer.choice)) {
        return {
          category: answer.choice,
          confidence: answer.confidence || 0.8,
        };
      }
    } catch (err) {
      console.warn('[Jev classifyCategory] Falha na Jev API, utilizando classificação heurística local:', err);
    }

    // Heurística local de fallback
    const lower = description.toLowerCase();
    if (/(?:almoco|almoço|jantar|cafe|café|lanche|coxinha|pastel|pizza|burger|restaurante|comida|mercado|supermercado|padaria|ifood|acai|açaí)/i.test(lower)) {
      const cat = options.find((c) => /alimenta/i.test(c));
      if (cat) return { category: cat, confidence: 0.9 };
    }
    if (/(?:uber|99|taxi|táxi|combustivel|combustível|gasolina|etanol|posto|pedagio|pedágio|estacionamento|passagem|onibus|ônibus|metro|metrô)/i.test(lower)) {
      const cat = options.find((c) => /transporte/i.test(c));
      if (cat) return { category: cat, confidence: 0.9 };
    }
    if (/(?:farmacia|farmácia|remedio|remédio|medico|médico|dentista|consulta|exame|hospital)/i.test(lower)) {
      const cat = options.find((c) => /saude|saúde/i.test(c));
      if (cat) return { category: cat, confidence: 0.9 };
    }
    if (/(?:aluguel|condominio|condomínio|luz|energia|agua|água|gas|gás|internet)/i.test(lower)) {
      const cat = options.find((c) => /moradia/i.test(c));
      if (cat) return { category: cat, confidence: 0.9 };
    }
    if (/(?:salario|salário|pro labore|pró-labore|honorarios|honorários|comissao|comissão)/i.test(lower)) {
      const cat = options.find((c) => /salario|salário|receita/i.test(c));
      if (cat) return { category: cat, confidence: 0.9 };
    }

    const defaultOther = options.find((c) => c === 'Outros') || options[0];
    return { category: defaultOther, confidence: 0.5 };
  }

  /**
   * Categorical Choice: Select the payment method used
   */
  async classifyPaymentMethod(
    description: string
  ): Promise<{ paymentMethod: PaymentMethod; confidence: number }> {
    const options: PaymentMethod[] = [...PAYMENT_METHODS];

    try {
      const result = await this.ask(description, {
        payment_method: {
          type: 'choice',
          instructions: 'What payment method was used in this transaction based on Brazilian financial context?',
          options,
          criteria: PAYMENT_METHOD_CRITERIA,
        },
      });

      const answer = result.answers.payment_method as JevChoiceResponse<PaymentMethod> | undefined;
      if (answer?.choice && options.includes(answer.choice)) {
        return {
          paymentMethod: answer.choice,
          confidence: answer.confidence || 0.85,
        };
      }
    } catch (err) {
      console.warn('[Jev classifyPaymentMethod] Falha na Jev API, utilizando fallback local:', err);
    }

    // Heurística local de fallback
    const lower = description.toLowerCase();
    if (/\bpix\b/i.test(lower)) {
      return { paymentMethod: 'PIX', confidence: 0.95 };
    }
    if (/(?:credito|crédito|fatura|parcelad)/i.test(lower)) {
      return { paymentMethod: 'CREDIT_CARD', confidence: 0.9 };
    }
    if (/(?:debito|débito)/i.test(lower)) {
      return { paymentMethod: 'DEBIT_CARD', confidence: 0.9 };
    }
    if (/(?:dinheiro|especie|espécie|cedula|cédula|moeda)/i.test(lower)) {
      return { paymentMethod: 'CASH', confidence: 0.9 };
    }
    if (/(?:ted|doc|deposito|depósito|transferencia|transferência)/i.test(lower)) {
      return { paymentMethod: 'BANK_TRANSFER', confidence: 0.85 };
    }

    return { paymentMethod: 'OTHER', confidence: 0.5 };
  }

  /**
   * Anomaly Score: Score how unusual this expense is compared to typical patterns
   */
  async scoreAnomaly(context: string): Promise<number> {
    try {
      const result = await this.ask(context, {
        anomaly_score: {
          type: 'score',
          instructions: 'Score from 0.0 (completely routine) to 1.0 (highly unusual or potential anomaly) the degree of financial abnormality in this transaction.',
          criteria: [
            'Totalmente rotineiro e comum no perfil de gastos.',
            'Ligeiramente atípico, mas plausível.',
            'Altamente anômalo ou suspeito de erro de valor.',
          ],
        },
      });

      const answer = result.answers.anomaly_score as JevScoreResponse | undefined;
      return typeof answer?.score === 'number' ? answer.score : 0.0;
    } catch (err) {
      console.warn('[Jev scoreAnomaly] Falha na Jev API, retornando 0.0 padrão:', err);
      return 0.0;
    }
  }
}

export const jev = new JevClient();
