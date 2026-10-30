'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, DollarSign, Calendar, Tag, CreditCard, AlignLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import type {
  TransactionEntity,
  TransactionType,
  PaymentMethod,
  CategoryEntity,
} from '@/types';

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transactionData: Partial<TransactionEntity>) => void;
  initialData?: TransactionEntity | null;
  categories: CategoryEntity[];
  isSaving?: boolean;
}

export function TransactionModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  categories,
  isSaving = false,
}: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setAmount(initialData.amount);
      setDescription(initialData.description);
      setCategoryId(initialData.categoryId);
      setPaymentMethod(initialData.paymentMethod);
      setTransactionDate(initialData.transactionDate);
    } else {
      setType('EXPENSE');
      setAmount('');
      setDescription('');
      const defaultCat = categories.find((c) => c.isDefault) || categories[0];
      setCategoryId(defaultCat ? defaultCat.id : '');
      setPaymentMethod('PIX');
      setTransactionDate(new Date().toISOString().split('T')[0]);
    }
    setErrors({});
  }, [initialData, isOpen, categories]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    const parsedAmount = parseFloat(amount.replace(',', '.'));

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = 'Informe um valor válido e positivo';
    }
    if (!description.trim()) {
      newErrors.description = 'A descrição é obrigatória';
    }
    if (!categoryId) {
      newErrors.categoryId = 'Selecione uma categoria';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      ...(initialData ? { id: initialData.id } : {}),
      type,
      amount: parsedAmount.toFixed(2),
      description: description.trim(),
      categoryId,
      paymentMethod,
      transactionDate,
      sourceChannel: initialData?.sourceChannel || 'WEB_DASHBOARD',
      confirmedByUser: true,
    });

    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden transition-all">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/60">
          <div>
            <h3 id="modal-title" className="text-base sm:text-lg font-bold text-foreground">
              {initialData ? 'Editar Lançamento' : 'Novo Lançamento'}
            </h3>
            <span className="text-xs text-muted-foreground">
              {initialData
                ? 'Atualize os dados e recalcularemos seus saldos'
                : 'Cadastre uma nova movimentação financeira manual'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Tipo: Despesa ou Receita */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Tipo de Movimentação
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('EXPENSE')}
                className={cn(
                  'h-10 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border transition-all',
                  type === 'EXPENSE'
                    ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400'
                    : 'bg-secondary/40 border-border text-muted-foreground hover:text-foreground'
                )}
              >
                <span>Saída (Despesa)</span>
              </button>
              <button
                type="button"
                onClick={() => setType('INCOME')}
                className={cn(
                  'h-10 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border transition-all',
                  type === 'INCOME'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'bg-secondary/40 border-border text-muted-foreground hover:text-foreground'
                )}
              >
                <span>Entrada (Receita)</span>
              </button>
            </div>
          </div>

          {/* Valor */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Valor (R$)
            </label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: '' }));
              }}
              icon={<DollarSign className="w-4 h-4 text-primary" />}
              className={cn(errors.amount && 'border-rose-500')}
            />
            {errors.amount && (
              <span className="text-[11px] text-rose-500 mt-1 block">
                {errors.amount}
              </span>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Descrição
            </label>
            <Input
              type="text"
              placeholder="Ex: Almoço no Restaurante, Supermercado..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
              }}
              icon={<AlignLeft className="w-4 h-4" />}
              className={cn(errors.description && 'border-rose-500')}
            />
            {errors.description && (
              <span className="text-[11px] text-rose-500 mt-1 block">
                {errors.description}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Categoria */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Categoria
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                <select
                  aria-label="Selecionar categoria"
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    if (errors.categoryId) setErrors((prev) => ({ ...prev, categoryId: '' }));
                  }}
                  className="w-full h-10 pl-9 pr-3 text-xs sm:text-sm bg-background border border-input rounded-xl text-foreground focus-ring cursor-pointer"
                >
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {errors.categoryId && (
                <span className="text-[11px] text-rose-500 mt-1 block">
                  {errors.categoryId}
                </span>
              )}
            </div>

            {/* Método de Pagamento */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Forma de Pagamento
              </label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                <select
                  aria-label="Selecionar forma de pagamento"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full h-10 pl-9 pr-3 text-xs sm:text-sm bg-background border border-input rounded-xl text-foreground focus-ring cursor-pointer"
                >
                  <option value="PIX">PIX</option>
                  <option value="CREDIT_CARD">Cartão de Crédito</option>
                  <option value="DEBIT_CARD">Cartão de Débito</option>
                  <option value="CASH">Dinheiro em Espécie</option>
                  <option value="BANK_TRANSFER">Transferência Bancária</option>
                  <option value="OTHER">Outros</option>
                </select>
              </div>
            </div>
          </div>

          {/* Data */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Data da Movimentação
            </label>
            <Input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              icon={<Calendar className="w-4 h-4" />}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/50">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" isLoading={isSaving} className="gap-1.5">
              <Check className="w-4 h-4" />
              <span>{initialData ? 'Salvar Alterações' : 'Salvar Lançamento'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
