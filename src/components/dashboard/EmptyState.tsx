'use client';

import React from 'react';
import {
  MessageSquare,
  Mic,
  Plus,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Link2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatPhoneDisplay, getBotWhatsAppUrl } from '@/lib/utils';

export interface EmptyStateProps {
  onOpenNewTransaction?: () => void;
  onOpenPairing?: () => void;
  whatsappPhone?: string | null;
}

export function EmptyState({
  onOpenNewTransaction,
  onOpenPairing,
  whatsappPhone,
}: EmptyStateProps) {
  const exampleMessages = [
    { type: 'Áudio ou Texto', text: '"Gastei 45 reais no almoço no cartão de crédito"' },
    { type: 'Pix / Transferência', text: '"Recebi 1.200 reais de freelance via Pix hoje"' },
    { type: 'Comprovante / Foto', text: 'Envie a foto ou PDF de um comprovante fiscal' },
  ];

  const formattedPhone = whatsappPhone ? formatPhoneDisplay(whatsappPhone) : null;
  const botChatUrl = getBotWhatsAppUrl('Olá! Gostaria de registrar meu primeiro gasto');

  return (
    <Card className="border-border/80 overflow-hidden bg-gradient-to-b from-card via-card to-secondary/30 text-center p-6 sm:p-10">
      <CardContent className="max-w-2xl mx-auto flex flex-col items-center">
        {/* Animated Brand Badge */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xl shadow-emerald-500/10">
            <Smartphone className="w-10 h-10" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Nenhuma movimentação registrada ainda
        </h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
          O WKontrolAI torna seu controle financeiro invisível e sem atritos. Você só precisa mandar uma mensagem no WhatsApp como se estivesse conversando com seu assistente!
        </p>

        {/* WhatsApp Interaction Card */}
        <div className="w-full mt-8 p-5 rounded-2xl bg-secondary/60 border border-border/80 text-left space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-emerald-500" />
              Como registrar seu primeiro gasto
            </span>
            {formattedPhone ? (
              <button
                type="button"
                onClick={onOpenPairing}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-medium font-mono hover:underline flex items-center gap-1.5 transition-colors"
                title="Clique para gerenciar o pareamento do WhatsApp"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>WhatsApp Pareado: {formattedPhone}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenPairing}
                className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1"
              >
                <Link2 className="w-3.5 h-3.5" />
                Vincule seu WhatsApp agora
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {exampleMessages.map((example, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-card border border-border/60 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-1 text-[11px] font-semibold text-primary mb-1">
                  <Mic className="w-3 h-3" />
                  {example.type}
                </div>
                <p className="text-xs text-muted-foreground italic">
                  {example.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-8 w-full sm:w-auto">
          {formattedPhone ? (
            <a
              href={botChatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button variant="whatsapp" className="w-full gap-2 shadow-md">
                <MessageSquare className="w-4 h-4" />
                Enviar Mensagem no WhatsApp
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
          ) : (
            <Button
              variant="whatsapp"
              onClick={onOpenPairing}
              className="w-full sm:w-auto gap-2 shadow-md"
            >
              <Smartphone className="w-4 h-4" />
              Vincular WhatsApp
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}

          <Button
            variant="outline"
            onClick={onOpenNewTransaction}
            className="w-full sm:w-auto gap-2"
          >
            <Plus className="w-4 h-4" />
            Lançar Manualmente no PWA
          </Button>
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Seus dados são protegidos com isolamento RLS e conformidade com a LGPD</span>
        </div>
      </CardContent>
    </Card>
  );
}
