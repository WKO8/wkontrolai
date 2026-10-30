'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { formatCurrency, cn } from '@/lib/utils';

export interface FinancialSummaryProps {
  currentBalance: number;
  totalIncome: number;
  totalExpense: number;
  previousMonthComparison?: {
    balanceDiffPercent: number;
    incomeDiffPercent: number;
    expenseDiffPercent: number;
  };
  isLoading?: boolean;
}

export function FinancialSummaryCards({
  currentBalance,
  totalIncome,
  totalExpense,
  previousMonthComparison = {
    balanceDiffPercent: 12.5,
    incomeDiffPercent: 8.2,
    expenseDiffPercent: -4.3,
  },
  isLoading = false,
}: FinancialSummaryProps) {
  const isPositiveBalance = currentBalance >= 0;
  const savingsRate =
    totalIncome > 0
      ? Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100))
      : 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-5 animate-pulse">
            <div className="h-4 bg-muted rounded w-24 mb-3" />
            <div className="h-8 bg-muted rounded w-36 mb-2" />
            <div className="h-3 bg-muted rounded w-20" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <section aria-label="Métricas Financeiras" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Saldo Atual */}
      <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card to-secondary/30 hover:border-primary/40 transition-all">
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-1',
            isPositiveBalance ? 'bg-emerald-500' : 'bg-rose-500'
          )}
        />
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Saldo Atual
            </span>
            <div
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center',
                isPositiveBalance
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              )}
            >
              <Wallet className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <div
              className={cn(
                'text-2xl lg:text-3xl font-extrabold tracking-tight',
                isPositiveBalance
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {formatCurrency(currentBalance)}
            </div>
          </div>

          <div className="mt-3 flex items-center text-xs text-muted-foreground">
            <div
              className={cn(
                'inline-flex items-center font-medium mr-1.5',
                previousMonthComparison.balanceDiffPercent >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {previousMonthComparison.balanceDiffPercent >= 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
              )}
              {Math.abs(previousMonthComparison.balanceDiffPercent)}%
            </div>
            <span>vs. mês anterior</span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Total de Receitas */}
      <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card to-secondary/30 hover:border-emerald-500/40 transition-all">
        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Receitas do Mês
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground">
              {formatCurrency(totalIncome)}
            </div>
          </div>

          <div className="mt-3 flex items-center text-xs text-muted-foreground">
            <div className="inline-flex items-center font-medium mr-1.5 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              +{previousMonthComparison.incomeDiffPercent}%
            </div>
            <span>vs. mês anterior</span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Total de Despesas */}
      <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card to-secondary/30 hover:border-rose-500/40 transition-all">
        <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Despesas do Mês
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground">
              {formatCurrency(totalExpense)}
            </div>
          </div>

          <div className="mt-3 flex items-center text-xs text-muted-foreground">
            <div
              className={cn(
                'inline-flex items-center font-medium mr-1.5',
                previousMonthComparison.expenseDiffPercent <= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {previousMonthComparison.expenseDiffPercent <= 0 ? (
                <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
              ) : (
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              )}
              {previousMonthComparison.expenseDiffPercent > 0 ? '+' : ''}
              {previousMonthComparison.expenseDiffPercent}%
            </div>
            <span>{previousMonthComparison.expenseDiffPercent <= 0 ? 'redução de gastos' : 'aumento'}</span>
          </div>
        </CardContent>
      </Card>

      {/* 4. Taxa de Poupança */}
      <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card to-secondary/30 hover:border-cyan-500/40 transition-all">
        <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-500" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Taxa de Poupança
            </span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground">
              {savingsRate}%
            </div>
          </div>

          <div className="mt-3 flex items-center text-xs text-muted-foreground">
            <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden mr-2">
              <div
                className="bg-cyan-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] font-medium text-cyan-600 dark:text-cyan-400">
              {savingsRate >= 20 ? 'Excelente' : savingsRate > 0 ? 'Regular' : 'Atenção'}
            </span>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
