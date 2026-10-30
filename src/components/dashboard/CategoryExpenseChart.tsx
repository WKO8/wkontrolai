'use client';

import React, { useState } from 'react';
import { PieChart, BarChart3 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { formatCurrency, cn } from '@/lib/utils';

export interface CategorySummaryItem {
  categoryId: string;
  categoryName: string;
  color: string;
  amount: number;
  percentage: number;
}

export interface MonthlyFlowItem {
  month: string;
  income: number;
  expense: number;
}

export interface CategoryExpenseChartProps {
  categories: CategorySummaryItem[];
  monthlyFlow?: MonthlyFlowItem[];
  totalExpense: number;
  isLoading?: boolean;
}

export function CategoryExpenseChart({
  categories,
  monthlyFlow = [
    { month: 'Mai', income: 4200, expense: 2900 },
    { month: 'Jun', income: 3900, expense: 3100 },
    { month: 'Jul', income: 4500, expense: 2800 },
    { month: 'Ago', income: 4100, expense: 2750 },
    { month: 'Set', income: 4300, expense: 2600 },
    { month: 'Out', income: 4800, expense: 2450 },
  ],
  totalExpense,
  isLoading = false,
}: CategoryExpenseChartProps) {
  const [activeTab, setActiveTab] = useState<'categories' | 'flow'>('categories');
  const [hoveredCategory, setHoveredCategory] = useState<CategorySummaryItem | null>(null);

  // Ordenar categorias pelo maior volume financeiro (US-07)
  const sortedCategories = [...categories].sort((a, b) => b.amount - a.amount);

  if (isLoading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-48 mb-4" />
        <div className="h-64 bg-muted/60 rounded-xl" />
      </Card>
    );
  }

  // Se não houver despesas no período
  if (totalExpense === 0 || sortedCategories.length === 0) {
    return (
      <Card className="border-dashed border-border/80 p-8 text-center flex flex-col items-center justify-center min-h-[320px]">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
          <PieChart className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-foreground">Sem despesas registradas</h4>
        <p className="text-xs text-muted-foreground max-w-xs mt-1">
          Não há despesas no período selecionado para compor a distribuição por categorias.
        </p>
      </Card>
    );
  }

  // Cálculo dos arcos SVG do Donut Chart
  let cumulativePercent = 0;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;

  return (
    <Card className="overflow-hidden border-border/80">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {activeTab === 'categories' ? (
              <>
                <PieChart className="w-4 h-4 text-primary" />
                Despesas por Categoria
              </>
            ) : (
              <>
                <BarChart3 className="w-4 h-4 text-primary" />
                Fluxo Comparativo (Últimos 6 meses)
              </>
            )}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {activeTab === 'categories'
              ? 'Distribuição proporcional dos gastos do período'
              : 'Comparativo histórico de Receitas vs Despesas'}
          </span>
        </div>

        {/* Alternador de visualização */}
        <div className="inline-flex items-center rounded-lg bg-secondary/80 p-0.5 text-xs border border-border/50">
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={cn(
              'px-2.5 py-1 rounded-md transition-all font-medium',
              activeTab === 'categories'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Categorias
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('flow')}
            className={cn(
              'px-2.5 py-1 rounded-md transition-all font-medium',
              activeTab === 'flow'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Fluxo Mensal
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {activeTab === 'categories' ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            {/* Visual Donut SVG */}
            <div className="md:col-span-5 flex flex-col items-center justify-center relative">
              <div className="relative w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center">
                <svg
                  viewBox="0 0 200 200"
                  className="w-full h-full -rotate-90 transform"
                  aria-label="Gráfico de rosca das despesas por categoria"
                  role="img"
                >
                  <circle
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="transparent"
                    stroke="currentColor"
                    className="text-muted/30"
                    strokeWidth="24"
                  />
                  {sortedCategories.map((cat) => {
                    const strokeDasharray = `${(cat.percentage / 100) * circumference} ${circumference}`;
                    const strokeDashoffset = -((cumulativePercent / 100) * circumference);
                    cumulativePercent += cat.percentage;
                    const isHovered = hoveredCategory?.categoryId === cat.categoryId;

                    return (
                      <circle
                        key={cat.categoryId}
                        cx="100"
                        cy="100"
                        r={radius}
                        fill="transparent"
                        stroke={cat.color}
                        strokeWidth={isHovered ? '28' : '24'}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="transition-all duration-300 cursor-pointer hover:opacity-90"
                        onMouseEnter={() => setHoveredCategory(cat)}
                        onMouseLeave={() => setHoveredCategory(null)}
                      />
                    );
                  })}
                </svg>

                {/* Centro do Donut com informações dinâmicas */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-3">
                  <span className="text-[11px] text-muted-foreground uppercase font-medium">
                    {hoveredCategory ? hoveredCategory.categoryName : 'Total Despesas'}
                  </span>
                  <span className="text-base sm:text-lg font-bold text-foreground">
                    {hoveredCategory
                      ? formatCurrency(hoveredCategory.amount)
                      : formatCurrency(totalExpense)}
                  </span>
                  <span className="text-xs font-semibold text-primary">
                    {hoveredCategory ? `${hoveredCategory.percentage}%` : '100%'}
                  </span>
                </div>
              </div>
            </div>

            {/* Legenda Ordenada pelo Maior Volume (US-07) */}
            <div className="md:col-span-7 space-y-2">
              {sortedCategories.map((cat) => {
                const isHovered = hoveredCategory?.categoryId === cat.categoryId;
                return (
                  <div
                    key={cat.categoryId}
                    onMouseEnter={() => setHoveredCategory(cat)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer text-xs sm:text-sm',
                      isHovered
                        ? 'bg-secondary/90 ring-1 ring-border'
                        : 'hover:bg-secondary/40'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-medium text-foreground truncate">
                        {cat.categoryName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 text-right">
                      <span className="font-semibold text-foreground whitespace-nowrap">
                        {formatCurrency(cat.amount)}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono w-9 text-right">
                        {cat.percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Visualização de Fluxo Mensal (Receitas vs Despesas 6 meses) */
          <div className="space-y-4">
            <div className="flex items-center justify-end gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500" />
                <span className="text-muted-foreground">Receitas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-500" />
                <span className="text-muted-foreground">Despesas</span>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-2 sm:gap-4 h-56 items-end pt-4 pb-2 border-b border-border/60">
              {monthlyFlow.map((item) => {
                const maxVal = Math.max(
                  ...monthlyFlow.map((m) => Math.max(m.income, m.expense)),
                  5000
                );
                const incomeHeight = (item.income / maxVal) * 100;
                const expenseHeight = (item.expense / maxVal) * 100;

                return (
                  <div key={item.month} className="flex flex-col items-center h-full justify-end group">
                    <div className="w-full flex items-end justify-center gap-1 sm:gap-2 h-44">
                      {/* Barra de Receitas */}
                      <div
                        className="w-3 sm:w-6 bg-emerald-500/90 rounded-t-md transition-all group-hover:brightness-110 relative"
                        style={{ height: `${incomeHeight}%` }}
                        title={`${item.month} - Receitas: ${formatCurrency(item.income)}`}
                      />
                      {/* Barra de Despesas */}
                      <div
                        className="w-3 sm:w-6 bg-rose-500/90 rounded-t-md transition-all group-hover:brightness-110 relative"
                        style={{ height: `${expenseHeight}%` }}
                        title={`${item.month} - Despesas: ${formatCurrency(item.expense)}`}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground mt-2">
                      {item.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
