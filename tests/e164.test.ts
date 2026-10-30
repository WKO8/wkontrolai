/**
 * WKontrolAI — Testes Unitários de Normalização e Validação Telefônica E.164
 * Padrão Brasileiro: +55 (País) + DDD (2 dígitos) + 9 dígitos celular (+55DD9XXXXXXXX)
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeBrazilianPhoneToE164,
  isValidBrazilianE164,
  formatPhoneDisplay,
  VALID_BRAZILIAN_DDDS,
  BRAZILIAN_E164_REGEX,
} from '@/lib/utils/phone';
import { whatsAppOtpVerificationSchema } from '@/lib/validations/webhook';

describe('1. Normalização de Telefones Brasileiros para E.164 (+55DD9XXXXXXXX)', () => {
  it('deve normalizar números já com prefixo internacional +55', () => {
    expect(normalizeBrazilianPhoneToE164('+5511999998888')).toBe('+5511999998888');
    expect(normalizeBrazilianPhoneToE164('+5521988887777')).toBe('+5521988887777');
    expect(normalizeBrazilianPhoneToE164('+5531977776666')).toBe('+5531977776666');
  });

  it('deve normalizar números com 55 sem o símbolo "+"', () => {
    expect(normalizeBrazilianPhoneToE164('5511999998888')).toBe('+5511999998888');
    expect(normalizeBrazilianPhoneToE164('5541991234567')).toBe('+5541991234567');
  });

  it('deve normalizar números nacionais com DDD sem DDI 55 (11 dígitos)', () => {
    expect(normalizeBrazilianPhoneToE164('11999998888')).toBe('+5511999998888');
    expect(normalizeBrazilianPhoneToE164('21987654321')).toBe('+5521987654321');
    expect(normalizeBrazilianPhoneToE164('81995554433')).toBe('+5581995554433');
  });

  it('deve normalizar números com formatações, parênteses, espaços e hifens', () => {
    expect(normalizeBrazilianPhoneToE164('(11) 99999-8888')).toBe('+5511999998888');
    expect(normalizeBrazilianPhoneToE164('+55 (21) 98765-4321')).toBe('+5521987654321');
    expect(normalizeBrazilianPhoneToE164('  +55 31 9 8888 7777  ')).toBe('+5531988887777');
    expect(normalizeBrazilianPhoneToE164('41-99888-7766')).toBe('+5541998887766');
  });

  it('deve normalizar identificadores de JID da Evolution API / WhatsApp', () => {
    expect(normalizeBrazilianPhoneToE164('5511999998888@s.whatsapp.net')).toBe('+5511999998888');
    expect(normalizeBrazilianPhoneToE164('5521987654321:12@s.whatsapp.net')).toBe('+5521987654321');
    expect(normalizeBrazilianPhoneToE164('+5531977776666@s.whatsapp.net')).toBe('+5531977776666');
  });

  it('deve autocompletar números móveis legados de 8 dígitos adicionando o 9º dígito', () => {
    // 11 9876-5432 -> adiciona o 9 inicial
    expect(normalizeBrazilianPhoneToE164('1198765432')).toBe('+5511998765432');
    // 55 21 8765-4321 -> adiciona o 9 inicial
    expect(normalizeBrazilianPhoneToE164('552187654321')).toBe('+5521987654321');
  });
});

describe('2. Validação de DDDs Brasileiros Válidos (Anatel)', () => {
  it('deve aceitar DDDs de capitais e interiores de todas as regiões', () => {
    const testCases = [
      { ddd: '11', city: 'São Paulo/SP' },
      { ddd: '19', city: 'Campinas/SP' },
      { ddd: '21', city: 'Rio de Janeiro/RJ' },
      { ddd: '27', city: 'Vitória/ES' },
      { ddd: '31', city: 'Belo Horizonte/MG' },
      { ddd: '41', city: 'Curitiba/PR' },
      { ddd: '48', city: 'Florianópolis/SC' },
      { ddd: '51', city: 'Porto Alegre/RS' },
      { ddd: '61', city: 'Brasília/DF' },
      { ddd: '62', city: 'Goiânia/GO' },
      { ddd: '71', city: 'Salvador/BA' },
      { ddd: '81', city: 'Recife/PE' },
      { ddd: '85', city: 'Fortaleza/CE' },
      { ddd: '91', city: 'Belém/PA' },
      { ddd: '92', city: 'Manaus/AM' },
    ];

    for (const { ddd } of testCases) {
      expect(VALID_BRAZILIAN_DDDS.has(ddd)).toBe(true);
      const phone = `+55${ddd}999998888`;
      expect(isValidBrazilianE164(phone)).toBe(true);
      expect(normalizeBrazilianPhoneToE164(phone)).toBe(phone);
    }
  });

  it('deve rejeitar DDDs inexistentes no Brasil', () => {
    const invalidDdds = ['00', '10', '20', '23', '25', '26', '29', '36', '39', '52', '72', '76'];

    for (const ddd of invalidDdds) {
      expect(VALID_BRAZILIAN_DDDS.has(ddd)).toBe(false);
      expect(() => normalizeBrazilianPhoneToE164(`+55${ddd}999998888`)).toThrow(/DDD.*não é um código de área válido/);
      expect(isValidBrazilianE164(`+55${ddd}999998888`)).toBe(false);
    }
  });
});

describe('3. Rejeição Estrita de Formatos Inválidos e Edge Cases', () => {
  it('deve rejeitar strings vazias, nulas ou sem dígitos', () => {
    expect(() => normalizeBrazilianPhoneToE164('')).toThrow(/vazio ou nulo/);
    expect(() => normalizeBrazilianPhoneToE164('   ')).toThrow(/não contém dígitos/);
    expect(() => normalizeBrazilianPhoneToE164('abc-def')).toThrow(/não contém dígitos/);
    expect(isValidBrazilianE164('')).toBe(false);
  });

  it('deve rejeitar números incompletos ou curtos demais', () => {
    expect(() => normalizeBrazilianPhoneToE164('119999')).toThrow(/Formato inválido/);
    expect(() => normalizeBrazilianPhoneToE164('+55119999')).toThrow(/Quantidade inválida de dígitos/);
    expect(isValidBrazilianE164('119999')).toBe(false);
  });

  it('deve rejeitar números longos demais', () => {
    expect(() => normalizeBrazilianPhoneToE164('+5511999998888123')).toThrow(/Quantidade inválida/);
    expect(() => normalizeBrazilianPhoneToE164('1199999888812345')).toThrow(/Formato inválido/);
    expect(isValidBrazilianE164('+5511999998888123')).toBe(false);
  });

  it('deve rejeitar telefones fixos (não suportados para WhatsApp bot)', () => {
    // Fixo com DDD: 11 3333-4444 (começa com 3)
    expect(() => normalizeBrazilianPhoneToE164('1133334444')).toThrow(/Telefone fixo brasileiro/);
    // Fixo com DDD: 21 2222-3333 (começa com 2)
    expect(() => normalizeBrazilianPhoneToE164('552122223333')).toThrow(/Telefone fixo brasileiro/);
  });

  it('deve validar regex oficial BRAZILIAN_E164_REGEX', () => {
    expect(BRAZILIAN_E164_REGEX.test('+5511999998888')).toBe(true);
    expect(BRAZILIAN_E164_REGEX.test('+5521988887777')).toBe(true);

    // Sem o sinal de mais
    expect(BRAZILIAN_E164_REGEX.test('5511999998888')).toBe(false);
    // Sem o 9º dígito móvel (começa com 8 em vez de 9 após o DDD)
    expect(BRAZILIAN_E164_REGEX.test('+5511899998888')).toBe(false);
    // Menos dígitos
    expect(BRAZILIAN_E164_REGEX.test('+55119999888')).toBe(false);
  });
});

describe('4. Formatação Amigável de Exibição (formatPhoneDisplay)', () => {
  it('deve formatar número E.164 no formato "+55 (DD) 9XXXX-XXXX"', () => {
    expect(formatPhoneDisplay('+5511999998888')).toBe('+55 (11) 99999-8888');
    expect(formatPhoneDisplay('5521987654321')).toBe('+55 (21) 98765-4321');
    expect(formatPhoneDisplay('31988887777')).toBe('+55 (31) 98888-7777');
  });

  it('deve retornar o valor original se não puder ser formatado', () => {
    expect(formatPhoneDisplay('invalid-number')).toBe('invalid-number');
  });
});

describe('5. Integração com Schemas Zod de Pareamento (OTP)', () => {
  it('whatsAppOtpVerificationSchema: deve aceitar telefone normalizado e código de 6 dígitos', () => {
    const valid = whatsAppOtpVerificationSchema.parse({
      code: '749201',
      whatsappPhone: '+5511999998888',
    });
    expect(valid.whatsappPhone).toBe('+5511999998888');
  });

  it('whatsAppOtpVerificationSchema: deve rejeitar formato de telefone inválido', () => {
    expect(() =>
      whatsAppOtpVerificationSchema.parse({
        code: '749201',
        whatsappPhone: 'invalid-phone',
      })
    ).toThrow(/Formato E.164 inválido/);
  });
});
