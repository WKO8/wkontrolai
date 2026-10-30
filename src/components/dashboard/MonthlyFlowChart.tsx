'use client';

import React, { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { formatCurrency, cn } from '@/lib/utils';

export interface MonthlyFlowItem {
  month: string;
  income: number;
  expense: number;
}

export interface MonthlyFlowChartProps {
  data?: MonthlyFlowItem[];
  isLoading?: boolean;
}

const DEFAULT_MONTHLY_DATA: MonthlyFlowItem[] = [
  { month: 'Mai', income: 5200, expense: 3400 },
  { month: 'Jun', income: 4800, expense: 3100 },
  { month: 'Jul', income: 5500, expense: 2900 },
  { month: 'Ago', income: 5100, expense: 3350 },
  { month: 'Set', income: 6200, expense: 3100 },
  { month: 'Out', income: 8350, expense: 3888 },
];

export function MonthlyFlowChart({
  data = DEFAULT_MONTHLY_DATA,
  isLoading = false,
}: MonthlyFlowChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.income, d.expense)),
    1000
  );

  if (isLoading) {
    return (
      <Card className="p-6 animate-pulse border-border/80">
        <div className="h-5 w-44 bg-muted rounded mb-4" />
        <div className="h-56 bg-muted/40 rounded-xl" />
      </Card>
    );
  }

  return (
    <Card className="border-border/80 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Fluxo Mensal: Receitas vs Despesas
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Comparativo histórico dos últimos 6 meses
          </span>
        </div>

        {/* Legenda de Cores */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 shadow-sm" />
            <span className="text-muted-foreground font-medium">Receitas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-rose-500 shadow-sm" />
            <span className="text-muted-foreground font-medium">Despesas</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="relative h-60 flex flex-col justify-between">
          {/* Linhas de grade de fundo */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
            <div className="border-b border-border/30 w-full" />
            <div className="border-b border-border/30 w-full" />
            <div className="border-b border-border/30 w-full" />
            <div className="border-b border-border/60 w-full" />
          </div>

          {/* Gráfico de Barras Agrupadas com maxBarSize restrito (evita barras gigantes) */}
          <div className="relative z-10 grid grid-cols-6 h-48 items-end gap-1 sm:gap-4 px-2">
            {data.map((item, idx) => {
              const incomeHeight = (item.income / maxValue) * 100;
              const expenseHeight = (item.expense / maxValue) * 100;
              const isHovered = hoveredIndex === idx;
              const netBalance = item.income - item.expense;

              return (
                <div
                  key={item.month}
                  className="flex flex-col items-center justify-end h-full group relative cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className="flex items-end justify-center gap-1 sm:gap-2 w-full max-w-[56px] h-44">
                    {/* Barra de Receitas */}
                    <div
                      className={cn(
                        'w-3 sm:w-5 bg-emerald-500 rounded-t-md transition-all duration-300 relative max-w-[24px]',
                        isHovered ? 'brightness-125 scale-y-105' : 'opacity-90'
                      )}
                      style={{ height: `${Math.max(6, incomeHeight)}%` }}
                    />

                    {/* Barra de Despesas */}
                    <div
                      className={cn(
                        'w-3 sm:w-5 bg-rose-500 rounded-t-md transition-all duration-300 relative max-w-[24px]',
                        isHovered ? 'brightness-125 scale-y-105' : 'opacity-90'
                      )}
                      style={{ height: `${Math.max(6, expenseHeight)}%` }}
                    />
                  </div>

                  {/* Nome do Mês */}
                  <span
                    className={cn(
                      'text-xs font-semibold mt-2 transition-colors',
                      isHovered ? 'text-primary font-bold' : 'text-muted-foreground'
                    )}
                  >
                    {item.month}
                  </span>

                  {/* Tooltip Dinâmico ao passar o mouse */}
                  {isHovered && (
                    <div className="absolute -top-20 z-30 pointer-events-none bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-xl p-2.5 text-xs whitespace-nowrap animate-fade-in">
                      <div className="font-bold text-foreground mb-1">{item.month}</div>
                      <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
                        <TrendingUp className="w-3 h-3" />
                        <span>Receitas: {formatCurrency(item.income)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-rose-500 font-medium">
                        <TrendingDown className="w-3 h-3" />
                        <span>Despesas: {formatCurrency(item.expense)}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground border-t border-border/50 pt-1 mt-1 font-mono">
                        Saldo: {formatCurrency(netBalance)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
