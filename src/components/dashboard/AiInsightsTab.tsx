'use client';

import React from 'react';
import {
  Printer,
  Sparkles,
  Calendar,
  Clock,
  PieChart,
  FileText,
  BarChart2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AiInsightsCard } from '@/components/dashboard/AiInsightsCard';
import { AiBeforeAfterSimulator } from '@/components/dashboard/AiBeforeAfterSimulator';
import { FinancialRagChatbot } from '@/components/dashboard/FinancialRagChatbot';
import { formatCurrency } from '@/lib/utils';
import type { AiInsightEntity, InsightFeedback, TransactionEntity } from '@/types';

export interface AiInsightsTabProps {
  insights: AiInsightEntity[];
  transactions: TransactionEntity[];
  pairedPhone?: string | null;
  selectedPeriod: string;
  onRateInsight?: (insightId: string, feedback: InsightFeedback) => void;
  onRefreshInsights?: () => void;
  isLoading?: boolean;
}

export function AiInsightsTab({
  insights,
  transactions,
  pairedPhone,
  selectedPeriod,
  onRateInsight,
  onRefreshInsights,
  isLoading = false,
}: AiInsightsTabProps) {
  const handlePrintPdf = () => {
    window.print();
  };

  // Cálculo de Concentração de Gastos por Dia da Semana (Padrão de Consumo)
  const weekdayConcentration = React.useMemo(() => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const map = [0, 0, 0, 0, 0, 0, 0];

    const expenses = transactions.filter((t) => t.type === 'EXPENSE');
    const totalExp = expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

    expenses.forEach((t) => {
      try {
        const d = new Date(`${t.transactionDate}T12:00:00Z`);
        const dayIdx = d.getDay();
        const amt = parseFloat(t.amount) || 0;
        map[dayIdx] += amt;
      } catch {
        // noop
      }
    });

    const maxAmt = Math.max(...map, 1);

    return days.map((dayName, idx) => ({
      day: dayName,
      amount: map[idx],
      percentage: totalExp > 0 ? Math.round((map[idx] / totalExp) * 100) : 0,
      barWidth: Math.round((map[idx] / maxAmt) * 100),
      isWeekend: idx === 0 || idx === 6 || idx === 5, // Sex, Sab, Dom
    }));
  }, [transactions]);

  // Cálculos consolidados para o cabeçalho executivo de impressão
  const totalIncome = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  const netBalance = totalIncome - totalExpense;

  return (
    <div className="space-y-6">
      {/* CABEÇALHO EXECUTIVO VISÍVEL APENAS NA IMPRESSÃO / PDF (0 MB VPS RAM) */}
      <div className="hidden print:block p-6 border-b-2 border-emerald-600 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              WKontrolAI — Relatório Financeiro Executivo
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Período de Referência: {selectedPeriod} | Gerado em:{' '}
              {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="text-right text-xs text-slate-600 font-mono">
            {pairedPhone && <span>WhatsApp: {pairedPhone}</span>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-500">Saldo Consolidado</span>
            <div className="text-lg font-bold text-slate-900">{formatCurrency(netBalance)}</div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-500">Receitas Totais</span>
            <div className="text-lg font-bold text-emerald-700">{formatCurrency(totalIncome)}</div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-500">Despesas Totais</span>
            <div className="text-lg font-bold text-rose-700">{formatCurrency(totalExpense)}</div>
          </div>
        </div>
      </div>

      {/* Barra de Ações do Topo */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-secondary/40 border border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Insights da IA & Assistente Financeiro
            </h2>
            <Badge variant="ai" className="text-xs">
              Modelos Jev & DeepSeek
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Análises preditivas, simulação de economia e chatbot RAG conectado aos seus dados reais.
          </p>
        </div>

        {/* Botão de Exportação em PDF Nativo (window.print()) */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePrintPdf}
          className="gap-2 shadow-sm font-semibold h-9 self-start sm:self-auto border-emerald-500/30 hover:border-emerald-500/50"
        >
          <Printer className="w-4 h-4 text-emerald-500" />
          <span>Exportar Relatório PDF</span>
        </Button>
      </div>

      {/* Grid Principal: Simulador "Antes vs Depois" + Chatbot RAG */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Simulador Comparativo (7 colunas) */}
        <div className="lg:col-span-7 w-full print-break-inside-avoid">
          <AiBeforeAfterSimulator
            currentMonthlySavings={Math.max(200, netBalance > 0 ? netBalance : 300)}
            aiSuggestedMonthlySavings={380}
          />
        </div>

        {/* Chatbot Financeiro RAG (5 colunas) */}
        <div className="lg:col-span-5 w-full no-print">
          <FinancialRagChatbot
            pairedPhone={pairedPhone}
            selectedPeriod={selectedPeriod}
          />
        </div>
      </div>

      {/* Seção Inferior: Diagnósticos Preditivos & Padrões Temporais */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cartões de Diagnósticos de IA */}
        <div className="lg:col-span-7 w-full print-break-inside-avoid">
          <AiInsightsCard
            insights={insights}
            transactionCount={transactions.length}
            onRateInsight={onRateInsight}
            onRefreshInsights={onRefreshInsights}
            isLoading={isLoading}
          />
        </div>

        {/* Card de Padrões e Correlações de Consumo */}
        <div className="lg:col-span-5 w-full print-break-inside-avoid">
          <Card className="border-border/80 overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Concentração por Dia da Semana
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  Padrões Temporais
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                Dias em que seu dinheiro mais tem saído no período
              </span>
            </CardHeader>

            <CardContent className="pt-4 space-y-2.5">
              {weekdayConcentration.map((w) => (
                <div key={w.day} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={
                        w.isWeekend
                          ? 'font-semibold text-emerald-500'
                          : 'text-muted-foreground'
                      }
                    >
                      {w.day}
                    </span>
                    <span className="font-mono text-foreground font-medium">
                      {formatCurrency(w.amount)} ({w.percentage}%)
                    </span>
                  </div>

                  <div className="w-full bg-secondary/80 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        w.isWeekend ? 'bg-emerald-500' : 'bg-primary/50'
                      }`}
                      style={{ width: `${Math.max(2, w.barWidth)}%` }}
                    />
                  </div>
                </div>
              ))}

              <div className="p-3 rounded-xl bg-secondary/50 border border-border/60 text-xs text-muted-foreground mt-3 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Dica de Economia:</strong> Gastos de sexta a domingo representam o maior
                  pico do seu orçamento. Estabelecer um teto fixo para o lazer nos finais de semana é
                  o ajuste mais eficiente.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
