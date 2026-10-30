import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina classes CSS com suporte a Tailwind Merge e condicionais
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formata um valor numérico ou string decimal no padrão monetário Brasileiro (BRL)
 * Exemplo: 1250.5 -> "R$ 1.250,50"
 */
export function formatCurrency(value: number | string): string {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numericValue)) return 'R$ 0,00';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

/**
 * Formata datas no padrão brasileiro
 * Exemplo: '2026-10-23' -> '23/10/2026' ou '23 de Outubro de 2026'
 */
export function formatDate(
  dateString: string | Date,
  options?: { format?: 'short' | 'medium' | 'long' }
): string {
  try {
    const date = typeof dateString === 'string' 
      ? new Date(dateString.includes('T') ? dateString : `${dateString}T12:00:00Z`)
      : dateString;

    if (isNaN(date.getTime())) return dateString.toString();

    if (options?.format === 'long') {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(date);
    }

    if (options?.format === 'medium') {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
      }).format(date);
    }

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch {
    return String(dateString);
  }
}

/**
 * Retorna uma cor hexadecimal ou classe Tailwind consistente para categorias
 */
export function getCategoryColor(categoryName: string): string {
  const normalized = categoryName.toLowerCase().trim();
  if (normalized.includes('aliment') || normalized.includes('restaurante') || normalized.includes('mercado') || normalized.includes('lanche')) {
    return '#f97316'; // Laranja
  }
  if (normalized.includes('morad') || normalized.includes('aluguel') || normalized.includes('condomínio') || normalized.includes('casa')) {
    return '#3b82f6'; // Azul
  }
  if (normalized.includes('transporte') || normalized.includes('uber') || normalized.includes('gasolina') || normalized.includes('combustível')) {
    return '#eab308'; // Amarelo
  }
  if (normalized.includes('saúde') || normalized.includes('farmácia') || normalized.includes('médico') || normalized.includes('hospital')) {
    return '#ef4444'; // Vermelho
  }
  if (normalized.includes('lazer') || normalized.includes('viagem') || normalized.includes('cinema') || normalized.includes('show')) {
    return '#a855f7'; // Roxo
  }
  if (normalized.includes('salário') || normalized.includes('receita') || normalized.includes('renda') || normalized.includes('freela') || normalized.includes('investimento')) {
    return '#10b981'; // Esmeralda / Verde
  }
  if (normalized.includes('educação') || normalized.includes('curso') || normalized.includes('livro')) {
    return '#06b6d4'; // Ciano
  }
  return '#64748b'; // Cinza ardósia padrão
}

export * from './utils/phone';

/**
 * Retorna o número oficial do bot do WhatsApp do WKontrolAI (E.164 limpo sem pontuação)
 */
export function getBotWhatsAppNumber(): string {
  const envPhone =
    process.env.NEXT_PUBLIC_BOT_PHONE ||
    process.env.EVOLUTION_BOT_PHONE ||
    '5511999999999';
  return envPhone.replace(/\D/g, '') || '5511999999999';
}

/**
 * Gera um link deep link seguro do WhatsApp apontando exclusivamente para o bot oficial
 */
export function getBotWhatsAppUrl(text?: string): string {
  const botNumber = getBotWhatsAppNumber();
  if (!text) {
    return `https://wa.me/${botNumber}`;
  }
  return `https://wa.me/${botNumber}?text=${encodeURIComponent(text)}`;
}
