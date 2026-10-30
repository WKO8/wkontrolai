'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  RotateCcw,
  Smartphone,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav, type BottomNavTab } from '@/components/layout/BottomNav';
import { FinancialSummaryCards } from '@/components/dashboard/FinancialSummaryCards';
import { MonthlyFlowChart, type MonthlyFlowItem } from '@/components/dashboard/MonthlyFlowChart';
import { CategoryExpenseChart, type CategorySummaryItem } from '@/components/dashboard/CategoryExpenseChart';
import { DailySpendingTrendChart } from '@/components/dashboard/DailySpendingTrendChart';
import { PaymentMethodsBreakdown } from '@/components/dashboard/PaymentMethodsBreakdown';
import { TransactionsList } from '@/components/dashboard/TransactionsList';
import { AiInsightsCard } from '@/components/dashboard/AiInsightsCard';
import { AiInsightsTab } from '@/components/dashboard/AiInsightsTab';
import { TransactionModal } from '@/components/dashboard/TransactionModal';
import { PairingModal } from '@/components/dashboard/PairingModal';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getCategoryColor } from '@/lib/utils';
import type {
  TransactionEntity,
  CategoryEntity,
  AiInsightEntity,
  InsightFeedback,
  PaymentMethod,
  SourceChannel,
} from '@/types';

// Mock de Categorias Padrão para inicialização rápida e fallback
const DEFAULT_CATEGORIES: CategoryEntity[] = [
  {
    id: 'cat-salario',
    tenantId: 'tenant-1',
    name: 'Salário & Renda',
    type: 'INCOME',
    icon: 'briefcase',
    color: '#10b981',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'cat-freelance',
    tenantId: 'tenant-1',
    name: 'Freelances / Extras',
    type: 'INCOME',
    icon: 'laptop',
    color: '#06b6d4',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'cat-alimentacao',
    tenantId: 'tenant-1',
    name: 'Alimentação & Mercado',
    type: 'EXPENSE',
    icon: 'utensils',
    color: '#f97316',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'cat-moradia',
    tenantId: 'tenant-1',
    name: 'Moradia & Contas',
    type: 'EXPENSE',
    icon: 'home',
    color: '#3b82f6',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'cat-transporte',
    tenantId: 'tenant-1',
    name: 'Transporte & Combustível',
    type: 'EXPENSE',
    icon: 'car',
    color: '#eab308',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'cat-saude',
    tenantId: 'tenant-1',
    name: 'Saúde & Farmácia',
    type: 'EXPENSE',
    icon: 'heart-pulse',
    color: '#ef4444',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'cat-lazer',
    tenantId: 'tenant-1',
    name: 'Lazer & Assinaturas',
    type: 'EXPENSE',
    icon: 'film',
    color: '#a855f7',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Insights Preditivos da IA (US-08)
const INITIAL_INSIGHTS: AiInsightEntity[] = [
  {
    id: 'insight-1',
    tenantId: 'tenant-1',
    type: 'EXPENSE_REDUCTION',
    title: 'Oportunidade: Redução em Refeições Rápidas & Delivery',
    content:
      'Identificamos que você gastou em pequenos lanches e delivery nas últimas semanas. Preparar 2 refeições a mais por semana geraria uma economia estimada de R$ 210,00/mês para a sua reserva.',
    dataPayload: { potentialSavings: 210, category: 'Alimentação' },
    userFeedback: 'UNRATED',
    createdAt: new Date(),
    expiresAt: null,
  },
  {
    id: 'insight-2',
    tenantId: 'tenant-1',
    type: 'ANOMALY_DETECTED',
    title: 'Anomalia Detectada: Transporte Acima da Média',
    content:
      'Seus gastos com combustível e corridas de aplicativo tiveram oscilações atípicas recentemente. Esse aumento costuma concentrar-se em deslocamentos de fim de semana.',
    dataPayload: { variancePercent: 38.8, metric: 'Transporte' },
    userFeedback: 'HELPFUL',
    createdAt: new Date(),
    expiresAt: null,
  },
  {
    id: 'insight-3',
    tenantId: 'tenant-1',
    type: 'CORRELATION',
    title: 'Padrão Temporal: 62% das despesas de lazer ocorrem no fim de semana',
    content:
      'Suas transações com cinema, jantares e passeios concentram-se fortemente entre sexta-feira à noite e domingo. Estabelecer um teto de R$ 150 por fim de semana manterá suas reservas seguras.',
    dataPayload: { weekendConcentration: 0.62 },
    userFeedback: 'UNRATED',
    createdAt: new Date(),
    expiresAt: null,
  },
];

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<TransactionEntity[]>([]);
  const [categories, setCategories] = useState<CategoryEntity[]>(DEFAULT_CATEGORIES);
  const [insights, setInsights] = useState<AiInsightEntity[]>(INITIAL_INSIGHTS);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-10');
  const [activeBottomTab, setActiveBottomTab] = useState<BottomNavTab>('dashboard');
  const [pairedPhone, setPairedPhone] = useState<string | null>(null);

  // Estados Visuais e Modais
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionEntity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Carrega telefone pareado do localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('wkontrol_paired_phone');
      if (stored) {
        setPairedPhone(stored);
      }
    } catch {
      // noop
    }
  }, []);

  // Busca dados de transações reais na API /api/transactions
  const loadData = useCallback(async (phone?: string | null, period?: string) => {
    setIsLoading(true);
    const activePeriod = period || selectedPeriod;
    const activePhone = phone !== undefined ? phone : pairedPhone;

    try {
      // 1. Carrega categorias do tenant
      try {
        const catUrl = activePhone
          ? `/api/categories?phone=${encodeURIComponent(activePhone)}`
          : '/api/categories';
        const catRes = await fetch(catUrl);
        if (catRes.ok) {
          const catData = await catRes.json();
          if (catData.categories && Array.isArray(catData.categories)) {
            setCategories(
              catData.categories.map((c: Record<string, unknown>) => ({
                id: String(c.id),
                tenantId: String(c.tenantId || 'tenant-1'),
                name: String(c.name),
                type: (c.type as 'EXPENSE' | 'INCOME') || 'EXPENSE',
                icon: (c.icon as string | null) || null,
                color: (c.color as string | null) || getCategoryColor(String(c.name)),
                isDefault: Boolean(c.isDefault),
                createdAt: c.createdAt ? new Date(String(c.createdAt)) : new Date(),
                updatedAt: c.updatedAt ? new Date(String(c.updatedAt)) : new Date(),
              }))
            );
          }
        }
      } catch {
        // Usa categorias padrão
      }

      // 2. Carrega extrato de transações
      const params = new URLSearchParams();
      if (activePeriod === 'last-90-days') {
        const today = new Date();
        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setDate(today.getDate() - 90);
        const todayStr = today.toISOString().split('T')[0];
        const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];
        params.append('startDate', ninetyDaysAgoStr);
        params.append('endDate', todayStr);
      } else if (activePeriod && activePeriod !== 'all') {
        params.append('period', activePeriod);
      }
      if (activePhone) {
        params.append('phone', activePhone);
      }

      const txRes = await fetch(`/api/transactions?${params.toString()}`);
      if (txRes.ok) {
        const txData = await txRes.json();
        if (txData.transactions && Array.isArray(txData.transactions)) {
          const mapped: TransactionEntity[] = txData.transactions.map((t: Record<string, unknown>) => ({
            id: String(t.id),
            tenantId: String(t.tenantId),
            userId: String(t.userId),
            categoryId: String(t.categoryId),
            type: (t.type as 'EXPENSE' | 'INCOME') || 'EXPENSE',
            amount: String(t.amount),
            description: String(t.description),
            paymentMethod: (t.paymentMethod as PaymentMethod) || 'OTHER',
            transactionDate: String(t.transactionDate),
            sourceChannel: (t.sourceChannel as SourceChannel) || 'WEB_DASHBOARD',
            confirmedByUser: Boolean(t.confirmedByUser),
            rawPayload: (t.rawPayload as string | null) || null,
            metadata: (t.metadata as Record<string, unknown> | null) || null,
            createdAt: new Date(String(t.createdAt)),
            updatedAt: new Date(String(t.updatedAt)),
          }));
          setTransactions(mapped);
        } else {
          setTransactions([]);
        }
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error('Falha ao carregar transações:', err);
      showToast('Não foi possível carregar os dados mais recentes do servidor.');
    } finally {
      setIsLoading(false);
    }
  }, [pairedPhone, selectedPeriod]);

  // Carrega transações ao iniciar ou ao mudar período/telefone
  useEffect(() => {
    loadData(pairedPhone, selectedPeriod);
  }, [pairedPhone, selectedPeriod, loadData]);

  // Cálculos consolidados de resumo financeiro
  const { currentBalance, totalIncome, totalExpense } = useMemo(() => {
    let income = 0;
    let expense = 0;

    transactions.forEach((tx) => {
      const val = parseFloat(tx.amount) || 0;
      if (tx.type === 'INCOME') {
        income += val;
      } else {
        expense += val;
      }
    });

    return {
      currentBalance: income - expense,
      totalIncome: income,
      totalExpense: expense,
    };
  }, [transactions]);

  // Distribuição de despesas por categoria
  const categorySummary = useMemo<CategorySummaryItem[]>(() => {
    if (totalExpense === 0) return [];

    const expenseMap = new Map<string, number>();
    transactions
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => {
        const val = parseFloat(t.amount) || 0;
        expenseMap.set(t.categoryId, (expenseMap.get(t.categoryId) || 0) + val);
      });

    const items: CategorySummaryItem[] = [];
    expenseMap.forEach((amount, categoryId) => {
      const cat = categories.find((c) => c.id === categoryId);
      const catName = cat?.name || 'Outros';
      const color = cat?.color || getCategoryColor(catName);
      const percentage = Math.round((amount / totalExpense) * 100);

      items.push({
        categoryId,
        categoryName: catName,
        color,
        amount,
        percentage,
      });
    });

    return items;
  }, [transactions, categories, totalExpense]);

  // Agrupamento mensal dos últimos 6 meses para o MonthlyFlowChart
  const monthlyFlowData = useMemo<MonthlyFlowItem[]>(() => {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const map = new Map<string, { month: string; income: number; expense: number }>();

    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = monthNames[d.getMonth()];
      map.set(key, { month: label, income: 0, expense: 0 });
    }

    transactions.forEach((tx) => {
      try {
        const ym = tx.transactionDate.substring(0, 7);
        const val = parseFloat(tx.amount) || 0;
        if (map.has(ym)) {
          const item = map.get(ym)!;
          if (tx.type === 'INCOME') {
            item.income += val;
          } else {
            item.expense += val;
          }
        }
      } catch {
        // noop
      }
    });

    const items = Array.from(map.values()).map(({ month, income, expense }) => ({
      month,
      income,
      expense,
    }));

    const hasData = items.some((item) => item.income > 0 || item.expense > 0);
    if (!hasData) {
      return [
        { month: 'Mai', income: 5200, expense: 3400 },
        { month: 'Jun', income: 4800, expense: 3100 },
        { month: 'Jul', income: 5500, expense: 2900 },
        { month: 'Ago', income: 5100, expense: 3350 },
        { month: 'Set', income: 6200, expense: 3100 },
        { month: 'Out', income: 8350, expense: 3888 },
      ];
    }
    return items;
  }, [transactions]);

  // Ações de Lançamento Manual e Pareamento
  const handleOpenNew = () => {
    setEditingTransaction(null);
    setIsTransactionModalOpen(true);
  };

  const handleEdit = (tx: TransactionEntity) => {
    setEditingTransaction(tx);
    setIsTransactionModalOpen(true);
  };

  const handleSaveTransaction = async (data: Partial<TransactionEntity>) => {
    setIsSaving(true);
    try {
      const parsedAmount = parseFloat(String(data.amount).replace(',', '.'));
      const validAmount = isNaN(parsedAmount) ? 0 : parsedAmount;

      if (editingTransaction) {
        // PATCH /api/transactions com auditoria
        const patchPayload = {
          id: editingTransaction.id,
          amount: validAmount,
          type: data.type || editingTransaction.type,
          categoryId: data.categoryId || editingTransaction.categoryId,
          description: data.description || editingTransaction.description,
          paymentMethod: data.paymentMethod || editingTransaction.paymentMethod,
          transactionDate: data.transactionDate || editingTransaction.transactionDate,
          phone: pairedPhone || undefined,
        };

        const response = await fetch('/api/transactions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchPayload),
        });

        const result = await response.json();

        if (!response.ok) {
          const errMsg = result.error || 'Erro ao atualizar lançamento';
          showToast(`Erro: ${errMsg}`);
          return;
        }

        showToast('Lançamento atualizado com sucesso no banco de dados!');
        setIsTransactionModalOpen(false);
        setEditingTransaction(null);
        await loadData(pairedPhone, selectedPeriod);
      } else {
        // POST /api/transactions com integração na API real
        const payload = {
          amount: validAmount,
          type: data.type || 'EXPENSE',
          categoryId: data.categoryId || (categories[0] ? categories[0].id : ''),
          description: data.description || 'Lançamento Manual',
          paymentMethod: data.paymentMethod || 'OTHER',
          transactionDate: data.transactionDate || new Date().toISOString().split('T')[0],
          sourceChannel: 'WEB_DASHBOARD',
          phone: pairedPhone || undefined,
        };

        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
          const errMsg =
            result.details?.fieldErrors?.amount?.[0] ||
            result.error ||
            'Erro ao salvar transação';
          showToast(`Erro: ${errMsg}`);
          return;
        }

        showToast('Novo lançamento registrado com sucesso no banco de dados!');
        setIsTransactionModalOpen(false);
        // Recarrega dados reais da API
        await loadData(pairedPhone, selectedPeriod);
      }
    } catch (err) {
      console.error('Erro ao salvar transação:', err);
      showToast('Falha na comunicação com o servidor ao salvar lançamento.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const params = new URLSearchParams({ id });
      if (pairedPhone) {
        params.append('phone', pairedPhone);
      }

      const response = await fetch(`/api/transactions?${params.toString()}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        showToast(`Erro ao excluir: ${result.error || 'Falha no servidor'}`);
        return;
      }

      setTransactions((prev) => prev.filter((t) => t.id !== id));
      showToast('Lançamento excluído com sucesso do extrato!');
    } catch (err) {
      console.error('Erro ao excluir transação:', err);
      showToast('Falha na comunicação ao tentar excluir lançamento.');
    }
  };

  const handleRateInsight = (insightId: string, feedback: InsightFeedback) => {
    setInsights((prev) =>
      prev.map((ins) => (ins.id === insightId ? { ...ins, userFeedback: feedback } : ins))
    );
    showToast('Obrigado pelo feedback! Nossa IA aprenderá com suas preferências.');
  };

  const handlePairSuccess = (phone: string) => {
    setPairedPhone(phone || null);
    if (phone) {
      showToast(`WhatsApp ${phone} vinculado com sucesso!`);
      loadData(phone, selectedPeriod);
    } else {
      showToast('Dispositivo desvinculado.');
      loadData(null, selectedPeriod);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-20 md:pb-10">
      {/* Barra de Navegação Topo */}
      <Navbar
        activeTab={activeBottomTab}
        onSelectTab={(tab) => {
          if (tab === 'settings') {
            setIsPairingModalOpen(true);
          } else {
            setActiveBottomTab(tab);
          }
        }}
        onOpenNewTransaction={handleOpenNew}
        onOpenPairing={() => setIsPairingModalOpen(true)}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        whatsappPhone={pairedPhone}
      />

      {/* Conteúdo Principal do Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Cabeçalho Dinâmico por Tela */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {activeBottomTab === 'transactions'
                  ? 'Extrato Financeiro'
                  : activeBottomTab === 'insights'
                    ? 'Insights da IA & Assistente'
                    : 'Métricas & Indicadores'}
              </h1>
              <Badge variant="outline" className="hidden sm:inline-flex">
                {selectedPeriod === 'last-90-days'
                  ? 'Últimos 90 dias'
                  : selectedPeriod === 'all'
                    ? 'Todos os períodos'
                    : selectedPeriod}
              </Badge>
              {pairedPhone ? (
                <button
                  type="button"
                  onClick={() => setIsPairingModalOpen(true)}
                  className="inline-flex focus-ring rounded-full cursor-pointer"
                >
                  <Badge variant="success" className="cursor-pointer hover:bg-emerald-500/20 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                    WhatsApp Conectado
                  </Badge>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPairingModalOpen(true)}
                  className="inline-flex sm:hidden focus-ring rounded-full cursor-pointer"
                >
                  <Badge variant="warning" className="cursor-pointer hover:bg-amber-500/20 transition-colors">
                    Vincular WhatsApp
                  </Badge>
                </button>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {activeBottomTab === 'transactions'
                ? 'Histórico completo de transações com filtros combinados, canais de origem e ações de edição/exclusão.'
                : activeBottomTab === 'insights'
                  ? 'Diagnósticos inteligentes, simulador de metas, concentração por dia e chatbot financeiro RAG.'
                  : pairedPhone
                    ? `Visão consolidada do fluxo de caixa e distribuição sincronizados com seu WhatsApp.`
                    : 'Conecte seu WhatsApp para registrar seus gastos por áudio, texto e foto.'}
            </p>
          </div>

          {/* Ações Rápidas de Recarregamento e Pareamento */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {!pairedPhone && (
              <Button
                variant="whatsapp"
                size="sm"
                onClick={() => setIsPairingModalOpen(true)}
                className="text-xs h-8 gap-1.5 shadow-sm"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Vincular WhatsApp</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(pairedPhone, selectedPeriod)}
              className="text-xs h-8 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Recarregar dados do servidor"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Atualizar
            </Button>
          </div>
        </section>

        {/* Notificação Toast */}
        {toastMessage && (
          <div className="fixed top-20 right-4 z-50 animate-fade-in">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-card border border-primary/30 shadow-2xl text-xs sm:text-sm font-medium text-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Renderização Condicional de Conteúdo */}
        {isLoading ? (
          <DashboardSkeleton />
        ) : transactions.length === 0 ? (
          /* Estado Vazio Acolhedor com Acesso ao Pareamento */
          <EmptyState
            onOpenNewTransaction={handleOpenNew}
            onOpenPairing={() => setIsPairingModalOpen(true)}
            whatsappPhone={pairedPhone}
          />
        ) : (
          <div>
            {/* TELA 1: MÉTRICAS & INDICADORES */}
            {activeBottomTab === 'dashboard' && (
              <div className="space-y-6">
                {/* 1. Cards de Resumo Financeiro */}
                <FinancialSummaryCards
                  currentBalance={currentBalance}
                  totalIncome={totalIncome}
                  totalExpense={totalExpense}
                />

                {/* 2. Grid de Fluxo Mensal e Distribuição por Categoria (Balanceado 6 + 6) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-6 w-full">
                    <MonthlyFlowChart data={monthlyFlowData} isLoading={isLoading} />
                  </div>
                  <div className="lg:col-span-6 w-full">
                    <CategoryExpenseChart
                      categories={categorySummary}
                      totalExpense={totalExpense}
                      isLoading={isLoading}
                    />
                  </div>
                </div>

                {/* 3. Tendência Diária de Gastos (Full Width para resolução analítica de 31 dias) */}
                <div className="w-full">
                  <DailySpendingTrendChart
                    transactions={transactions}
                    period={
                      selectedPeriod === 'last-90-days' || selectedPeriod === 'all'
                        ? '2026-10'
                        : selectedPeriod
                    }
                    isLoading={isLoading}
                  />
                </div>

                {/* 4. Meios de Pagamento (Full Width com 4 colunas confortáveis para cada modalidade) */}
                <div className="w-full">
                  <PaymentMethodsBreakdown
                    transactions={transactions}
                    isLoading={isLoading}
                  />
                </div>
              </div>
            )}

            {/* TELA 2: EXTRATO FINANCEIRO DEDICADO */}
            {activeBottomTab === 'transactions' && (
              <div className="space-y-6">
                <TransactionsList
                  transactions={transactions}
                  categories={categories}
                  onEditTransaction={handleEdit}
                  onDeleteTransaction={handleDeleteTransaction}
                  onOpenNewTransaction={handleOpenNew}
                  isLoading={isLoading}
                />
              </div>
            )}

            {/* TELA 3: INSIGHTS DA IA & ASSISTENTE */}
            {activeBottomTab === 'insights' && (
              <div className="space-y-6">
                <AiInsightsTab
                  insights={insights}
                  transactions={transactions}
                  pairedPhone={pairedPhone}
                  selectedPeriod={selectedPeriod}
                  onRateInsight={handleRateInsight}
                  onRefreshInsights={() => loadData(pairedPhone, selectedPeriod)}
                  isLoading={isLoading}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal de Criação / Edição de Transação */}
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSave={handleSaveTransaction}
        initialData={editingTransaction}
        categories={categories}
        isSaving={isSaving}
      />

      {/* Modal de Pareamento do WhatsApp (US-01 / US-07) */}
      <PairingModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        currentPhone={pairedPhone}
        onPairSuccess={handlePairSuccess}
      />

      {/* Navegação Inferior Mobile-first */}
      <BottomNav
        activeTab={activeBottomTab}
        onSelectTab={(tab) => {
          if (tab === 'settings') {
            setIsPairingModalOpen(true);
          } else {
            setActiveBottomTab(tab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onOpenNewTransaction={handleOpenNew}
        hasUnreadInsights={true}
      />
    </div>
  );
}
