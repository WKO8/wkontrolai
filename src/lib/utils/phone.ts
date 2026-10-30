/**
 * WKontrolAI — Utilitários de Normalização e Validação Telefônica E.164
 * Padrão Brasileiro: +55 (Código do País) + DDD (2 dígitos) + 9 dígitos móveis
 * Formato canônico: +55DD9XXXXXXXX (13 caracteres numéricos com prefixo '+')
 */

// Lista dos 67 DDDs válidos no Brasil (Resolução Anatel)
export const VALID_BRAZILIAN_DDDS = new Set([
  // SP
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  // RJ / ES
  '21', '22', '24', '27', '28',
  // MG
  '31', '32', '33', '34', '35', '37', '38',
  // PR / SC
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  // RS
  '51', '53', '54', '55',
  // DF / GO / TO / MT / MS
  '61', '62', '64', '63', '65', '66', '67',
  // BA / SE
  '71', '73', '74', '75', '77', '79',
  // PE / AL / PB / RN
  '81', '87', '82', '83', '84',
  // CE / PI
  '85', '88', '86', '89',
  // PA / AP / AM / RR / AC / RO
  '91', '93', '94', '96', '92', '97', '95', '68', '69',
]);

/**
 * Regex para validação estrita de telefone celular brasileiro no formato E.164 (+55DD9XXXXXXXX)
 * Exatamente 13 dígitos: +55 seguido de DDD válido e 9 dígitos iniciando com '9'.
 */
export const BRAZILIAN_E164_REGEX = /^\+55(\d{2})(9\d{8})$/;

/**
 * Normaliza qualquer formato de telefone brasileiro para o padrão internacional E.164 (+55DD9XXXXXXXX).
 * Trata entradas de WhatsApp (com @s.whatsapp.net, :dispositivo), pontuações, parênteses e traços.
 *
 * @throws {Error} Se o número for inválido, incompleto ou não pertencer a um DDD brasileiro válido.
 */
export function normalizeBrazilianPhoneToE164(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Número de telefone não pode ser vazio ou nulo');
  }

  // 1. Remove sufixos de JID do WhatsApp (ex: "@s.whatsapp.net", ":12@s.whatsapp.net")
  const withoutJid = input.split('@')[0].split(':')[0].trim();

  // 2. Extrai apenas dígitos
  const digits = withoutJid.replace(/\D/g, '');

  if (digits.length === 0) {
    throw new Error('Telefone não contém dígitos válidos');
  }

  let fullDigits = digits;

  // 3. Trata prefixo de país (55)
  if (fullDigits.startsWith('55')) {
    // Já possui DDI 55
    const nationalPart = fullDigits.substring(2);

    if (nationalPart.length === 11) {
      // Formato: 55 + DDD (2) + 9 dígitos (celular atual)
      fullDigits = '55' + nationalPart;
    } else if (nationalPart.length === 10) {
      // Formato legado: 55 + DDD (2) + 8 dígitos móveis (sem o 9º dígito)
      const ddd = nationalPart.substring(0, 2);
      const number = nationalPart.substring(2);
      // Celulares móveis no Brasil antes do 9º dígito começavam com 6, 7, 8 ou 9
      if (['6', '7', '8', '9'].includes(number.charAt(0))) {
        fullDigits = `55${ddd}9${number}`;
      } else {
        throw new Error(
          `Telefone fixo brasileiro (${ddd} ${number}) não é suportado para WhatsApp no WKontrolAI`
        );
      }
    } else {
      throw new Error(
        `Quantidade inválida de dígitos para telefone brasileiro com DDI 55: ${fullDigits.length} dígitos`
      );
    }
  } else {
    // Não possui DDI 55 — assume que é número nacional com DDD
    if (fullDigits.length === 11) {
      // DDD (2) + 9 dígitos
      fullDigits = `55${fullDigits}`;
    } else if (fullDigits.length === 10) {
      // DDD (2) + 8 dígitos
      const ddd = fullDigits.substring(0, 2);
      const number = fullDigits.substring(2);
      if (['6', '7', '8', '9'].includes(number.charAt(0))) {
        fullDigits = `55${ddd}9${number}`;
      } else {
        throw new Error(
          `Telefone fixo brasileiro (${ddd} ${number}) não é suportado para WhatsApp no WKontrolAI`
        );
      }
    } else {
      throw new Error(
        `Formato inválido de telefone brasileiro: esperado 10 ou 11 dígitos nacionais, recebido ${fullDigits.length}`
      );
    }
  }

  // 4. Validação final do E.164 brasileiro (+55DD9XXXXXXXX)
  const e164 = `+${fullDigits}`;
  const match = e164.match(BRAZILIAN_E164_REGEX);

  if (!match) {
    throw new Error(
      `Número ${e164} não cumpre o padrão E.164 de celular brasileiro (+55DD9XXXXXXXX)`
    );
  }

  const ddd = match[1];
  if (!VALID_BRAZILIAN_DDDS.has(ddd)) {
    throw new Error(`DDD ${ddd} não é um código de área válido no Brasil`);
  }

  return e164;
}

/**
 * Validador booleano sem lançamento de exceção
 */
export function isValidBrazilianE164(phone: string): boolean {
  try {
    normalizeBrazilianPhoneToE164(phone);
    return true;
  } catch {
    return false;
  }
}

/**
 * Formata um telefone E.164 para exibição amigável ao usuário
 * Exemplo: "+5511999998888" -> "+55 (11) 99999-8888"
 */
export function formatPhoneDisplay(e164Phone: string): string {
  try {
    const canonical = normalizeBrazilianPhoneToE164(e164Phone);
    const ddd = canonical.substring(3, 5);
    const part1 = canonical.substring(5, 10);
    const part2 = canonical.substring(10, 14);
    return `+55 (${ddd}) ${part1}-${part2}`;
  } catch {
    return e164Phone;
  }
}
