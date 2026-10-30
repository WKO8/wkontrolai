'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  FileCheck2,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Check,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { AiInsightEntity, InsightFeedback, InsightType } from '@/types';

export interface AiInsightsCardProps {
  insights: AiInsightEntity[];
  transactionCount: number;
  onRefreshInsights?: () => void;
  onRateInsight?: (insightId: string, feedback: InsightFeedback) => void;
  isLoading?: boolean;
}

export function AiInsightsCard({
  insights,
  transactionCount,
  onRefreshInsights,
  onRateInsight,
  isLoading = false,
}: AiInsightsCardProps) {
  const [ratedMap, setRatedMap] = useState<Record<string, InsightFeedback>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleFeedback = (insightId: string, feedback: InsightFeedback) => {
    setRatedMap((prev) => ({ ...prev, [insightId]: feedback }));
    onRateInsight?.(insightId, feedback);
  };

  const handleTriggerRefresh = () => {
    setIsRefreshing(true);
    onRefreshInsights?.();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1200);
  };

  const getInsightIcon = (type: InsightType) => {
    switch (type) {
      case 'EXPENSE_REDUCTION':
        return <TrendingDown className="w-4 h-4 text-emerald-500" />;
      case 'ANOMALY_DETECTED':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'CORRELATION':
        return <Lightbulb className="w-4 h-4 text-cyan-500" />;
      case 'MONTHLY_SUMMARY':
        return <FileCheck2 className="w-4 h-4 text-indigo-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-primary" />;
    }
  };

  const getInsightBadge = (type: InsightType) => {
    switch (type) {
      case 'EXPENSE_REDUCTION':
        return <Badge variant="success">Oportunidade de Economia</Badge>;
      case 'ANOMALY_DETECTED':
        return <Badge variant="warning">Anomalia Identificada</Badge>;
      case 'CORRELATION':
        return <Badge variant="ai">Padrão de Consumo</Badge>;
      case 'MONTHLY_SUMMARY':
        return <Badge variant="default">Diagnóstico Mensal</Badge>;
      default:
        return <Badge variant="secondary">Análise IA</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-48 mb-4" />
        <div className="h-28 bg-muted/60 rounded-xl mb-3" />
        <div className="h-28 bg-muted/60 rounded-xl" />
      </Card>
    );
  }

  // Regra de Cold Start (US-08): Menos de 10 transações
  if (transactionCount < 10) {
    return (
      <Card className="border-border/80 relative overflow-hidden bg-gradient-to-br from-card via-card to-primary/5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              Insights & Inteligência Preditiva
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {transactionCount}/10 transações para calibração
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="p-4 sm:p-5 rounded-2xl bg-secondary/50 border border-border/60 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">
                Estamos aprendendo sobre seus hábitos financeiros!
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Precisamos de pelo menos <strong>10 transações</strong> para identificar anomalias e sugerir cortes de despesas com precisão real. Continue lançando seus gastos pelo WhatsApp enviando mensagens de texto ou áudio!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 relative overflow-hidden bg-gradient-to-br from-card via-card to-primary/5">
      <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            Insights Inteligentes da IA
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Oportunidades de corte de custos, padrões e alertas detectados automaticamente
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleTriggerRefresh}
          isLoading={isRefreshing}
          className="text-xs gap-1.5 h-8"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
          <span className="hidden sm:inline">Gerar Nova Análise</span>
        </Button>
      </CardHeader>

      <CardContent className="pt-4 space-y-3.5">
        {insights.map((insight) => {
          const feedback = ratedMap[insight.id] || insight.userFeedback;
          return (
            <div
              key={insight.id}
              className="p-4 rounded-xl border border-border/70 bg-card/60 hover:bg-card/90 transition-all hover:border-primary/30 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-secondary text-foreground">
                    {getInsightIcon(insight.type)}
                  </div>
                  <h4 className="text-sm font-semibold text-foreground tracking-tight">
                    {insight.title}
                  </h4>
                </div>
                {getInsightBadge(insight.type)}
              </div>

              {/* Conteúdo do Insight */}
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {insight.content}
              </p>

              {/* Rodapé do Insight com feedback human-in-the-loop (US-08) */}
              <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                <span className="text-muted-foreground text-[11px]">
                  Detectado pelo modelo financeiro Jev/DeepSeek
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground mr-1">Esta análise foi útil?</span>
                  <button
                    type="button"
                    onClick={() => handleFeedback(insight.id, 'HELPFUL')}
                    className={cn(
                      'p-1.5 rounded-md hover:bg-secondary text-muted-foreground transition-colors',
                      feedback === 'HELPFUL' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                    )}
                    title="Útil"
                    aria-label="Avaliar insight como útil"
                  >
                    {feedback === 'HELPFUL' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <ThumbsUp className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback(insight.id, 'NOT_HELPFUL')}
                    className={cn(
                      'p-1.5 rounded-md hover:bg-secondary text-muted-foreground transition-colors',
                      feedback === 'NOT_HELPFUL' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold'
                    )}
                    title="Não se aplica"
                    aria-label="Avaliar insight como não se aplica"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
