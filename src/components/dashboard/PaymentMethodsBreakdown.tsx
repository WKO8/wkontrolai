'use client';

import React, { useMemo } from 'react';
import {
  Smartphone,
  CreditCard,
  Banknote,
  Wallet,
  ArrowUpRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { formatCurrency, cn } from '@/lib/utils';
import type { TransactionEntity, PaymentMethod } from '@/types';

export interface PaymentMethodsBreakdownProps {
  transactions: TransactionEntity[];
  isLoading?: boolean;
}

interface MethodItem {
  key: PaymentMethod;
  name: string;
  icon: React.ElementType;
  color: string;
  badgeBg: string;
  textColor: string;
  amount: number;
  count: number;
  percentage: number;
}

export function PaymentMethodsBreakdown({
  transactions,
  isLoading = false,
}: PaymentMethodsBreakdownProps) {
  const breakdown = useMemo<MethodItem[]>(() => {
    const totalExpense = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

    const methodsConfig: Record<
      PaymentMethod,
      { name: string; icon: React.ElementType; color: string; badgeBg: string; textColor: string }
    > = {
      PIX: {
        name: 'PIX',
        icon: Smartphone,
        color: '#06b6d4',
        badgeBg: 'bg-cyan-500/10 border-cyan-500/20',
        textColor: 'text-cyan-500',
      },
      CREDIT_CARD: {
        name: 'Cartão de Crédito',
        icon: CreditCard,
        color: '#818cf8',
        badgeBg: 'bg-indigo-500/10 border-indigo-500/20',
        textColor: 'text-indigo-400',
      },
      DEBIT_CARD: {
        name: 'Cartão de Débito',
        icon: CreditCard,
        color: '#38bdf8',
        badgeBg: 'bg-sky-500/10 border-sky-500/20',
        textColor: 'text-sky-400',
      },
      CASH: {
        name: 'Dinheiro',
        icon: Banknote,
        color: '#10b981',
        badgeBg: 'bg-emerald-500/10 border-emerald-500/20',
        textColor: 'text-emerald-500',
      },
      BANK_TRANSFER: {
        name: 'Transferência',
        icon: Wallet,
        color: '#f59e0b',
        badgeBg: 'bg-amber-500/10 border-amber-500/20',
        textColor: 'text-amber-500',
      },
      OTHER: {
        name: 'Outros',
        icon: Wallet,
        color: '#94a3b8',
        badgeBg: 'bg-slate-500/10 border-slate-500/20',
        textColor: 'text-slate-400',
      },
    };

    const map = new Map<PaymentMethod, { amount: number; count: number }>();

    transactions
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => {
        const method = t.paymentMethod || 'OTHER';
        const val = parseFloat(t.amount) || 0;
        const curr = map.get(method) || { amount: 0, count: 0 };
        map.set(method, { amount: curr.amount + val, count: curr.count + 1 });
      });

    const items: MethodItem[] = [];

    // Prioriza PIX, CREDIT_CARD, DEBIT_CARD, CASH
    const prioritizedKeys: PaymentMethod[] = [
      'PIX',
      'CREDIT_CARD',
      'DEBIT_CARD',
      'CASH',
      'BANK_TRANSFER',
      'OTHER',
    ];

    prioritizedKeys.forEach((key) => {
      const data = map.get(key) || { amount: 0, count: 0 };
      const config = methodsConfig[key];
      const percentage = totalExpense > 0 ? Math.round((data.amount / totalExpense) * 100) : 0;

      items.push({
        key,
        name: config.name,
        icon: config.icon,
        color: config.color,
        badgeBg: config.badgeBg,
        textColor: config.textColor,
        amount: data.amount,
        count: data.count,
        percentage,
      });
    });

    return items;
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4 border-border/80">
            <div className="h-4 w-20 bg-muted rounded mb-2" />
            <div className="h-6 w-28 bg-muted rounded mb-2" />
            <div className="h-2 w-full bg-muted/60 rounded" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card className="border-border/80 overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Meios de Pagamento
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Distribuição dos gastos por modalidade
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {breakdown.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="p-4 rounded-2xl bg-secondary/40 border border-border/70 hover:border-border transition-all flex flex-col justify-between space-y-3"
              >
                {/* Linha 1: Topo com Ícone à esquerda e Badge de % no canto superior direito */}
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-sm',
                      item.badgeBg,
                      item.textColor
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border',
                      item.badgeBg,
                      item.textColor
                    )}
                  >
                    {item.percentage}%
                  </span>
                </div>

                {/* Linhas 2, 3 e 4: Nome em largura total, Valor de destaque e Quantidade */}
                <div>
                  <span className="text-xs font-semibold text-muted-foreground block mb-0.5 mt-1">
                    {item.name}
                  </span>
                  <div className="text-xl font-extrabold tracking-tight text-foreground font-mono">
                    {formatCurrency(item.amount)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {item.count} {item.count === 1 ? 'lançamento' : 'lançamentos'}
                  </div>
                </div>

                {/* Linha 5: Barra de porcentagem visual com cor correspondente */}
                <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
