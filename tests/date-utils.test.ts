/**
 * WKontrolAI — Testes Unitários de Utilitários de Data e Período
 * Cobre: getCurrentPeriod, getAvailablePeriods, getMonthDateRange e transactionPeriodSchema
 */

import { describe, it, expect } from 'vitest';
import {
  getCurrentPeriod,
  getAvailablePeriods,
  getMonthDateRange,
  type PeriodOption,
} from '@/lib/utils/date';
import {
  getCurrentPeriod as getCurrentPeriodFromRootUtils,
  getAvailablePeriods as getAvailablePeriodsFromRootUtils,
  getMonthDateRange as getMonthDateRangeFromRootUtils,
} from '@/lib/utils';
import { transactionPeriodSchema } from '@/lib/validations/transaction';

describe('Utilitários de Data e Período (date-utils)', () => {
  describe('1. getCurrentPeriod(referenceDate)', () => {
    it('deve retornar formato YYYY-MM para data atual quando nenhum argumento for passado', () => {
      const now = new Date();
      const expectedYear = now.getFullYear();
      const expectedMonth = String(now.getMonth() + 1).padStart(2, '0');
      const expected = `${expectedYear}-${expectedMonth}`;

      const result = getCurrentPeriod();
      expect(result).toBe(expected);
      expect(result).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    });

    it('deve retornar "2026-11" para 2 de Novembro de 2026', () => {
      const refDate = new Date(2026, 10, 2); // Mês 10 = Novembro
      expect(getCurrentPeriod(refDate)).toBe('2026-11');
    });

    it('deve retornar "2026-01" com zero à esquerda para 15 de Janeiro de 2026', () => {
      const refDate = new Date(2026, 0, 15); // Mês 0 = Janeiro
      expect(getCurrentPeriod(refDate)).toBe('2026-01');
    });

    it('deve retornar "2025-12" no último dia do ano (31 de Dezembro de 2025)', () => {
      const refDate = new Date(2025, 11, 31); // Mês 11 = Dezembro
      expect(getCurrentPeriod(refDate)).toBe('2025-12');
    });

    it('deve lidar corretamente com anos bissextos (29 de Fevereiro de 2024)', () => {
      const refDate = new Date(2024, 1, 29); // Mês 1 = Fevereiro
      expect(getCurrentPeriod(refDate)).toBe('2024-02');
    });

    it('deve lidar com o primeiro e último dia do mesmo mês mantendo consistência', () => {
      const firstDay = new Date(2026, 4, 1); // 1 de Maio
      const lastDay = new Date(2026, 4, 31); // 31 de Maio
      expect(getCurrentPeriod(firstDay)).toBe('2026-05');
      expect(getCurrentPeriod(lastDay)).toBe('2026-05');
    });
  });

  describe('2. getAvailablePeriods(monthsBack, referenceDate) — Tamanho e Opções Agregadas', () => {
    it('deve gerar 6 períodos por padrão (monthsBack = 3: 4 meses + 2 agregadas)', () => {
      const periods = getAvailablePeriods(3, new Date(2026, 10, 2));
      expect(periods).toHaveLength(6);
      expect(periods[4]).toEqual({ value: 'last-90-days', label: 'Últimos 90 dias' });
      expect(periods[5]).toEqual({ value: 'all', label: 'Todos os períodos' });
    });

    it('deve suportar monthsBack customizado (monthsBack = 5: 6 meses + 2 agregadas = 8 opções)', () => {
      const periods = getAvailablePeriods(5, new Date(2026, 10, 2));
      expect(periods).toHaveLength(8);
      expect(periods[6]).toEqual({ value: 'last-90-days', label: 'Últimos 90 dias' });
      expect(periods[7]).toEqual({ value: 'all', label: 'Todos os períodos' });
    });

    it('deve suportar monthsBack = 0 (1 mês atual + 2 agregadas = 3 opções)', () => {
      const periods = getAvailablePeriods(0, new Date(2026, 10, 2));
      expect(periods).toHaveLength(3);
      expect(periods[0].value).toBe('2026-11');
      expect(periods[1]).toEqual({ value: 'last-90-days', label: 'Últimos 90 dias' });
      expect(periods[2]).toEqual({ value: 'all', label: 'Todos os períodos' });
    });

    it('deve usar 3 como monthsBack padrão se omitido', () => {
      const periodsDefault = getAvailablePeriods(undefined, new Date(2026, 10, 2));
      expect(periodsDefault).toHaveLength(6);
      expect(periodsDefault.map((p) => p.value)).toEqual([
        '2026-11',
        '2026-10',
        '2026-09',
        '2026-08',
        'last-90-days',
        'all',
      ]);
    });
  });

  describe('3. getAvailablePeriods — Sufixo "(Atual)" e Capitalização em Português', () => {
    it('deve adicionar o sufixo "(Atual)" apenas no primeiro elemento (índice 0)', () => {
      const refDate = new Date(2026, 10, 2);
      const periods = getAvailablePeriods(3, refDate);

      // Primeiro elemento deve ter (Atual)
      expect(periods[0].label).toContain('(Atual)');
      expect(periods[0].label).toBe('Novembro 2026 (Atual)');

      // Elementos subsequentes não devem ter (Atual)
      for (let i = 1; i < periods.length; i++) {
        expect(periods[i].label).not.toContain('(Atual)');
      }
    });

    it('deve capitalizar corretamente a primeira letra do mês em português para todos os meses gerados', () => {
      const refDate = new Date(2026, 10, 2);
      const periods = getAvailablePeriods(3, refDate);

      // Validação específica dos rótulos dos meses
      expect(periods[0].label).toBe('Novembro 2026 (Atual)');
      expect(periods[1].label).toBe('Outubro 2026');
      expect(periods[2].label).toBe('Setembro 2026');
      expect(periods[3].label).toBe('Agosto 2026');

      // Verifica que a primeira letra de cada mês é maiúscula
      const monthPeriods = periods.slice(0, 4);
      for (const p of monthPeriods) {
        const firstChar = p.label.charAt(0);
        expect(firstChar).toBe(firstChar.toUpperCase());
        expect(firstChar).not.toBe(firstChar.toLowerCase());
      }
    });
  });

  describe('4. getAvailablePeriods — Suporte à Virada de Ano', () => {
    it('deve retroceder os anos corretamente ao iniciar em janeiro (ex: Janeiro 2027 -> Dezembro 2026 -> Novembro 2026...)', () => {
      const refDate = new Date(2027, 0, 15); // Janeiro de 2027
      const periods = getAvailablePeriods(3, refDate);

      expect(periods).toHaveLength(6);
      expect(periods[0]).toEqual({
        value: '2027-01',
        label: 'Janeiro 2027 (Atual)',
      });
      expect(periods[1]).toEqual({
        value: '2026-12',
        label: 'Dezembro 2026',
      });
      expect(periods[2]).toEqual({
        value: '2026-11',
        label: 'Novembro 2026',
      });
      expect(periods[3]).toEqual({
        value: '2026-10',
        label: 'Outubro 2026',
      });
      expect(periods[4]).toEqual({
        value: 'last-90-days',
        label: 'Últimos 90 dias',
      });
      expect(periods[5]).toEqual({
        value: 'all',
        label: 'Todos os períodos',
      });
    });

    it('deve suportar viradas de múltiplos anos com monthsBack elevado', () => {
      const refDate = new Date(2026, 1, 10); // Fevereiro de 2026
      const periods = getAvailablePeriods(14, refDate); // 15 meses: Fev 2026 até Dez 2024

      expect(periods).toHaveLength(17); // 15 meses + 2 agregados
      expect(periods[0].value).toBe('2026-02');
      expect(periods[0].label).toBe('Fevereiro 2026 (Atual)');
      expect(periods[1].value).toBe('2026-01');
      expect(periods[1].label).toBe('Janeiro 2026');
      expect(periods[2].value).toBe('2025-12');
      expect(periods[2].label).toBe('Dezembro 2025');
      expect(periods[14].value).toBe('2024-12');
      expect(periods[14].label).toBe('Dezembro 2024');
      expect(periods[15]).toEqual({ value: 'last-90-days', label: 'Últimos 90 dias' });
      expect(periods[16]).toEqual({ value: 'all', label: 'Todos os períodos' });
    });
  });

  describe('5. getMonthDateRange(period) — Cálculo do Intervalo Real do Mês', () => {
    it('deve retornar "2026-11-01" e "2026-11-30" para Novembro (30 dias)', () => {
      const range = getMonthDateRange('2026-11');
      expect(range).toEqual({
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      });
    });

    it('deve retornar "2026-10-01" e "2026-10-31" para Outubro (31 dias)', () => {
      const range = getMonthDateRange('2026-10');
      expect(range).toEqual({
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });
    });

    it('deve retornar "2024-02-01" e "2024-02-29" para Fevereiro em ano bissexto (29 dias)', () => {
      const range = getMonthDateRange('2024-02');
      expect(range).toEqual({
        startDate: '2024-02-01',
        endDate: '2024-02-29',
      });
    });

    it('deve retornar "2026-02-01" e "2026-02-28" para Fevereiro em ano não bissexto (28 dias)', () => {
      const range = getMonthDateRange('2026-02');
      expect(range).toEqual({
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      });
    });

    it('deve retornar "2026-04-01" e "2026-04-30" para Abril (30 dias)', () => {
      const range = getMonthDateRange('2026-04');
      expect(range).toEqual({
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      });
    });

    it('deve lançar erro para meses inválidos como "2026-00" e "2026-13"', () => {
      expect(() => getMonthDateRange('2026-00')).toThrow(/Formato de período inválido/);
      expect(() => getMonthDateRange('2026-13')).toThrow(/Formato de período inválido/);
    });

    it('deve lançar erro para strings mal formatadas como "invalid"', () => {
      expect(() => getMonthDateRange('invalid')).toThrow(/Formato de período inválido/);
      expect(() => getMonthDateRange('')).toThrow(/Formato de período inválido/);
    });
  });

  describe('6. Conformidade de Tipos e Re-exportação em src/lib/utils.ts', () => {
    it('deve permitir importação idêntica a partir de "@/lib/utils"', () => {
      const refDate = new Date(2026, 10, 2);
      expect(getCurrentPeriodFromRootUtils(refDate)).toBe(getCurrentPeriod(refDate));
      expect(getAvailablePeriodsFromRootUtils(3, refDate)).toEqual(getAvailablePeriods(3, refDate));
      expect(getMonthDateRangeFromRootUtils('2026-11')).toEqual(getMonthDateRange('2026-11'));
    });

    it('deve assegurar que todos os itens respeitam a interface PeriodOption', () => {
      const periods: PeriodOption[] = getAvailablePeriods(3, new Date(2026, 10, 2));
      for (const item of periods) {
        expect(typeof item.value).toBe('string');
        expect(typeof item.label).toBe('string');
        expect(item.value.length).toBeGreaterThan(0);
        expect(item.label.length).toBeGreaterThan(0);
      }
    });
  });

  describe('7. Validação de transactionPeriodSchema (@/lib/validations/transaction)', () => {
    it('deve aceitar períodos válidos no formato YYYY-MM com mês entre 01 e 12', () => {
      expect(transactionPeriodSchema.safeParse('2026-01').success).toBe(true);
      expect(transactionPeriodSchema.safeParse('2026-12').success).toBe(true);
      expect(transactionPeriodSchema.safeParse('2026-06').success).toBe(true);
      expect(transactionPeriodSchema.safeParse('last-90-days').success).toBe(true);
      expect(transactionPeriodSchema.safeParse('all').success).toBe(true);
    });

    it('deve rejeitar meses inválidos como "2026-00" e "2026-13"', () => {
      const result00 = transactionPeriodSchema.safeParse('2026-00');
      expect(result00.success).toBe(false);

      const result13 = transactionPeriodSchema.safeParse('2026-13');
      expect(result13.success).toBe(false);
    });

    it('deve rejeitar strings mal formatadas', () => {
      expect(transactionPeriodSchema.safeParse('invalid').success).toBe(false);
      expect(transactionPeriodSchema.safeParse('2026-1').success).toBe(false);
      expect(transactionPeriodSchema.safeParse('26-05').success).toBe(false);
    });
  });
});
