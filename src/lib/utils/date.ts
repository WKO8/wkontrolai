export interface PeriodOption {
  value: string;
  label: string;
}

export function getCurrentPeriod(referenceDate: Date = new Date()): string {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getAvailablePeriods(monthsBack: number = 3, referenceDate: Date = new Date()): PeriodOption[] {
  const periods: PeriodOption[] = [];
  for (let i = 0; i <= monthsBack; i++) {
    const target = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const rawMonth = target.toLocaleDateString('pt-BR', { month: 'long' });
    const capitalizedMonth = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);
    const value = `${year}-${month}`;
    const label = i === 0 ? `${capitalizedMonth} ${year} (Atual)` : `${capitalizedMonth} ${year}`;
    periods.push({ value, label });
  }
  periods.push({ value: 'last-90-days', label: 'Últimos 90 dias' });
  periods.push({ value: 'all', label: 'Todos os períodos' });
  return periods;
}
