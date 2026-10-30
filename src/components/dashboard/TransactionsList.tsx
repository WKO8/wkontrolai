'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Mic,
  MessageSquare,
  FileImage,
  Globe,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Banknote,
  Smartphone,
  Layers,
  AlertCircle,
  Plus,
  Camera,
  Laptop,
  TrendingUp,
  TrendingDown,
  Filter,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency, formatDate, getCategoryColor, cn } from '@/lib/utils';
import type {
  TransactionEntity,
  TransactionType,
  PaymentMethod,
  SourceChannel,
  CategoryEntity,
} from '@/types';

export interface TransactionsListProps {
  transactions: TransactionEntity[];
  categories: CategoryEntity[];
  onEditTransaction?: (transaction: TransactionEntity) => void;
  onDeleteTransaction?: (transactionId: string) => void;
  onOpenNewTransaction?: () => void;
  isLoading?: boolean;
}

export function TransactionsList({
  transactions,
  categories,
  onEditTransaction,
  onDeleteTransaction,
  onOpenNewTransaction,
  isLoading = false,
}: TransactionsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | TransactionType>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'ALL' | PaymentMethod>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const PAGE_SIZE = 12;

  // Mapa de categorias por ID para lookups rápidos
  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryEntity>();
    categories.forEach((cat) => map.set(cat.id, cat));
    return map;
  }, [categories]);

  // Filtro composto: Busca textual + Tipo + Categoria + Meio de Pagamento
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Filtro de Tipo
      if (selectedType !== 'ALL' && t.type !== selectedType) {
        return false;
      }

      // Filtro de Categoria
      if (selectedCategoryId !== 'ALL' && t.categoryId !== selectedCategoryId) {
        return false;
      }

      // Filtro de Forma de Pagamento
      if (selectedPaymentMethod !== 'ALL' && t.paymentMethod !== selectedPaymentMethod) {
        return false;
      }

      // Busca textual por descrição ou nome da categoria
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesDesc = t.description.toLowerCase().includes(query);
        const catName = categoryMap.get(t.categoryId)?.name.toLowerCase() || '';
        const matchesCategory = catName.includes(query);
        if (!matchesDesc && !matchesCategory) return false;
      }

      return true;
    });
  }, [transactions, selectedType, selectedCategoryId, selectedPaymentMethod, searchQuery, categoryMap]);

  // Totais agregados do filtro ativo
  const { filteredIncome, filteredExpense, filteredNet } = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach((t) => {
      const val = parseFloat(t.amount) || 0;
      if (t.type === 'INCOME') income += val;
      else expense += val;
    });
    return {
      filteredIncome: income,
      filteredExpense: expense,
      filteredNet: income - expense,
    };
  }, [filteredTransactions]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, currentPage]);

  // Helper para canal de origem com ícones específicos
  const renderSourceChannel = (channel: SourceChannel) => {
    switch (channel) {
      case 'WHATSAPP_AUDIO':
        return (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full"
            title="Lançado via Áudio do WhatsApp"
          >
            <Mic className="w-3 h-3 text-emerald-500" />
            <span>Áudio</span>
          </span>
        );
      case 'WHATSAPP_IMAGE':
        return (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full"
            title="Lançado via Comprovante/Foto do WhatsApp"
          >
            <Camera className="w-3 h-3 text-cyan-500" />
            <span>Comprovante</span>
          </span>
        );
      case 'WHATSAPP_TEXT':
        return (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full"
            title="Lançado via Mensagem de Texto do WhatsApp"
          >
            <MessageSquare className="w-3 h-3 text-emerald-500" />
            <span>Texto</span>
          </span>
        );
      case 'WEB_DASHBOARD':
      default:
        return (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
            title="Lançado manualmente no Web Dashboard"
          >
            <Laptop className="w-3 h-3 text-muted-foreground" />
            <span>Web</span>
          </span>
        );
    }
  };

  // Helper para método de pagamento
  const renderPaymentMethod = (method: PaymentMethod) => {
    switch (method) {
      case 'PIX':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-foreground font-mono">
            <Smartphone className="w-3.5 h-3.5 text-cyan-500" />
            PIX
          </span>
        );
      case 'CREDIT_CARD':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-foreground">
            <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
            Crédito
          </span>
        );
      case 'DEBIT_CARD':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-foreground">
            <CreditCard className="w-3.5 h-3.5 text-blue-400" />
            Débito
          </span>
        );
      case 'CASH':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-foreground">
            <Banknote className="w-3.5 h-3.5 text-emerald-500" />
            Dinheiro
          </span>
        );
      default:
        return <span className="text-xs text-muted-foreground">{method}</span>;
    }
  };

  const confirmDelete = () => {
    if (transactionToDelete) {
      onDeleteTransaction?.(transactionToDelete);
      setTransactionToDelete(null);
    }
  };

  return (
    <>
      <Card className="border-border/80 overflow-hidden">
        <CardHeader className="p-4 sm:p-6 border-b border-border/50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Extrato Financeiro Completo
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                Consulte, filtre e gerencie cada movimentação registrada na sua conta
              </span>
            </div>

            <Button
              size="sm"
              onClick={onOpenNewTransaction}
              className="gap-1.5 h-9 shadow-sm shadow-primary/20 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Lançamento</span>
            </Button>
          </div>

          {/* Badges de Resumo do Filtro Ativo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="p-2.5 rounded-xl bg-secondary/50 border border-border/60">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                Total Receitas
              </span>
              <span className="text-xs sm:text-sm font-bold text-emerald-500 font-mono">
                +{formatCurrency(filteredIncome)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-secondary/50 border border-border/60">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                Total Despesas
              </span>
              <span className="text-xs sm:text-sm font-bold text-rose-500 font-mono">
                -{formatCurrency(filteredExpense)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-secondary/50 border border-border/60">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                Saldo Líquido
              </span>
              <span
                className={cn(
                  'text-xs sm:text-sm font-bold font-mono',
                  filteredNet >= 0 ? 'text-emerald-500' : 'text-rose-500'
                )}
              >
                {formatCurrency(filteredNet)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-secondary/50 border border-border/60">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                Lançamentos
              </span>
              <span className="text-xs sm:text-sm font-bold text-foreground font-mono">
                {filteredTransactions.length} itens
              </span>
            </div>
          </div>

          {/* Barra de Filtros Combinados */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Input de Busca */}
            <div className="sm:col-span-4">
              <Input
                placeholder="Buscar por descrição..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                icon={<Search className="w-4 h-4" />}
                className="h-9 text-xs sm:text-sm"
              />
            </div>

            {/* Filtro por Tipo */}
            <div className="sm:col-span-2">
              <select
                aria-label="Filtrar por tipo"
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value as 'ALL' | TransactionType);
                  setCurrentPage(1);
                }}
                className="w-full h-9 px-3 text-xs bg-background border border-input rounded-xl text-foreground focus-ring cursor-pointer"
              >
                <option value="ALL">Todos os Tipos</option>
                <option value="EXPENSE">Apenas Despesas</option>
                <option value="INCOME">Apenas Receitas</option>
              </select>
            </div>

            {/* Filtro por Categoria */}
            <div className="sm:col-span-3">
              <select
                aria-label="Filtrar por categoria"
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 px-3 text-xs bg-background border border-input rounded-xl text-foreground focus-ring cursor-pointer"
              >
                <option value="ALL">Todas as Categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Forma de Pagamento */}
            <div className="sm:col-span-3">
              <select
                aria-label="Filtrar por forma de pagamento"
                value={selectedPaymentMethod}
                onChange={(e) => {
                  setSelectedPaymentMethod(e.target.value as 'ALL' | PaymentMethod);
                  setCurrentPage(1);
                }}
                className="w-full h-9 px-3 text-xs bg-background border border-input rounded-xl text-foreground focus-ring cursor-pointer"
              >
                <option value="ALL">Todos os Meios</option>
                <option value="PIX">PIX</option>
                <option value="CREDIT_CARD">Cartão de Crédito</option>
                <option value="DEBIT_CARD">Cartão de Débito</option>
                <option value="CASH">Dinheiro</option>
                <option value="BANK_TRANSFER">Transferência</option>
                <option value="OTHER">Outros</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <div className="py-14 text-center flex flex-col items-center justify-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-3">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Nenhum lançamento corresponde aos filtros
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Tente ajustar os filtros acima ou registre um novo lançamento manual ou pelo WhatsApp.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50">
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-4">Descrição</th>
                      <th className="py-3 px-4">Categoria</th>
                      <th className="py-3 px-4 hidden md:table-cell">Pagamento</th>
                      <th className="py-3 px-4 hidden sm:table-cell">Canal</th>
                      <th className="py-3 px-4 text-right">Valor</th>
                      <th className="py-3 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 text-xs sm:text-sm">
                    {paginatedTransactions.map((tx) => {
                      const category = categoryMap.get(tx.categoryId);
                      const catName = category?.name || 'Geral';
                      const catColor = category?.color || getCategoryColor(catName);
                      const isIncome = tx.type === 'INCOME';

                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-secondary/40 transition-colors group"
                        >
                          {/* Data */}
                          <td className="py-3 px-4 text-muted-foreground whitespace-nowrap font-mono text-xs">
                            {formatDate(tx.transactionDate, { format: 'short' })}
                          </td>

                          {/* Descrição */}
                          <td className="py-3 px-4 font-medium text-foreground max-w-[220px] sm:max-w-xs truncate">
                            {tx.description}
                          </td>

                          {/* Categoria */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: `${catColor}15`,
                                color: catColor,
                                border: `1px solid ${catColor}30`,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: catColor }}
                              />
                              {catName}
                            </span>
                          </td>

                          {/* Método de Pagamento */}
                          <td className="py-3 px-4 hidden md:table-cell whitespace-nowrap">
                            {renderPaymentMethod(tx.paymentMethod)}
                          </td>

                          {/* Canal de Origem */}
                          <td className="py-3 px-4 hidden sm:table-cell whitespace-nowrap">
                            {renderSourceChannel(tx.sourceChannel)}
                          </td>

                          {/* Valor */}
                          <td className="py-3 px-4 text-right font-semibold whitespace-nowrap font-mono">
                            <span
                              className={
                                isIncome
                                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                  : 'text-foreground font-medium'
                              }
                            >
                              {isIncome ? '+' : '-'} {formatCurrency(tx.amount)}
                            </span>
                          </td>

                          {/* Ações (Editar e Excluir) */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => onEditTransaction?.(tx)}
                                aria-label={`Editar lançamento ${tx.description}`}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-ring"
                                title="Editar Lançamento"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setTransactionToDelete(tx.id)}
                                aria-label={`Excluir lançamento ${tx.description}`}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors focus-ring"
                                title="Excluir Lançamento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 text-xs text-muted-foreground">
                  <span>
                    Página {currentPage} de {totalPages} ({filteredTransactions.length} registros)
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 px-2"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 px-2"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Confirmação de Exclusão Segura */}
      {transactionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground">
                  Confirmar Exclusão
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Deseja realmente excluir este lançamento? Esta ação recalculará seus saldos no banco de dados.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTransactionToDelete(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmDelete}
              >
                Sim, Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
