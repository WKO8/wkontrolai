'use client';

import React, { useState, useMemo } from 'react';
import { Sparkles, TrendingUp, PiggyBank, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, cn } from '@/lib/utils';

export interface AiBeforeAfterSimulatorProps {
  currentMonthlySavings?: number;
  aiSuggestedMonthlySavings?: number;
}

export function AiBeforeAfterSimulator({
  currentMonthlySavings = 450,
  aiSuggestedMonthlySavings = 380,
}: AiBeforeAfterSimulatorProps) {
  const [selectedMonths, setSelectedMonths] = useState<3 | 6 | 12>(6);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const baselineSavings = Math.max(100, currentMonthlySavings);
  const extraSavings = Math.max(150, aiSuggestedMonthlySavings);
  const optimizedMonthlySavings = baselineSavings + extraSavings;

  // Projeção mês a mês
  const projection = useMemo(() => {
    const list: Array<{
      monthNum: number;
      label: string;
      currentBalance: number;
      optimizedBalance: number;
      difference: number;
    }> = [];

    for (let m = 0; m <= selectedMonths; m++) {
      const current = m * baselineSavings;
      const optimized = m * optimizedMonthlySavings;
      list.push({
        monthNum: m,
        label: m === 0 ? 'Hoje' : `Mês ${m}`,
        currentBalance: current,
        optimizedBalance: optimized,
        difference: optimized - current,
      });
    }

    return list;
  }, [selectedMonths, baselineSavings, optimizedMonthlySavings]);

  const maxTotal = projection[projection.length - 1].optimizedBalance || 1000;
  const totalExtraSaved = projection[projection.length - 1].difference;
  const percentageGain = Math.round((extraSavings / baselineSavings) * 100);

  // SVG Geometry
  const width = 580;
  const height = 180;
  const padX = 24;
  const padTop = 20;
  const padBottom = 28;
  const chartW = width - padX * 2;
  const chartH = height - padTop - padBottom;

  const points = useMemo(() => {
    return projection.map((p, i) => {
      const x = padX + (i / (projection.length - 1)) * chartW;
      const yCurrent = padTop + chartH - (p.currentBalance / maxTotal) * chartH;
      const yOptimized = padTop + chartH - (p.optimizedBalance / maxTotal) * chartH;
      return { ...p, x, yCurrent, yOptimized };
    });
  }, [projection, chartW, chartH, maxTotal, padX, padTop]);

  // Linhas
  const pathCurrent = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, curr, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${curr.x} ${curr.yCurrent}`, '');
  }, [points]);

  const pathOptimized = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, curr, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${curr.x} ${curr.yOptimized}`, '');
  }, [points]);

  // Área entre a linha otimizada e a linha atual (destaque de economia)
  const areaDifference = useMemo(() => {
    if (points.length === 0) return '';
    const forward = points.reduce((acc, curr, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${curr.x} ${curr.yOptimized}`, '');
    const backward = [...points].reverse().reduce((acc, curr) => `${acc} L ${curr.x} ${curr.yCurrent}`, '');
    return `${forward} ${backward} Z`;
  }, [points]);

  return (
    <Card className="border-border/80 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border/50 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              Simulador "Antes vs. Depois"
            </CardTitle>
            <Badge variant="ai" className="text-[10px]">
              Projeção Inteligente
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            Comparativo do seu patrimônio acumulado com e sem os ajustes sugeridos pela IA
          </span>
        </div>

        {/* Seletor de Horizonte Temporal */}
        <div className="inline-flex items-center rounded-xl bg-secondary/80 p-0.5 text-xs border border-border/50 self-start sm:self-auto">
          {([3, 6, 12] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedMonths(m)}
              className={cn(
                'px-3 py-1 rounded-lg font-medium transition-all',
                selectedMonths === m
                  ? 'bg-card text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {m} meses
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Banner de Impacto da Economia */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-cyan-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <PiggyBank className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Economia Acumulada em {selectedMonths} meses:</div>
              <div className="text-lg font-black text-emerald-500 font-mono tracking-tight">
                +{formatCurrency(totalExtraSaved)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Badge variant="success">+{percentageGain}% de poupança</Badge>
            <span className="text-muted-foreground text-[11px]">
              ({formatCurrency(extraSavings)}/mês a mais)
            </span>
          </div>
        </div>

        {/* Gráfico SVG Dual-Area */}
        <div className="relative w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-44 sm:h-48 select-none"
            role="img"
            aria-label="Simulador comparativo antes e depois"
          >
            <defs>
              <linearGradient id="diffGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {/* Linhas de grade horizontais */}
            <line x1={padX} y1={padTop} x2={width - padX} y2={padTop} stroke="currentColor" className="text-border/30" strokeDasharray="3 3" />
            <line x1={padX} y1={padTop + chartH / 2} x2={width - padX} y2={padTop + chartH / 2} stroke="currentColor" className="text-border/30" strokeDasharray="3 3" />
            <line x1={padX} y1={padTop + chartH} x2={width - padX} y2={padTop + chartH} stroke="currentColor" className="text-border/80" />

            {/* Área sombreada entre as linhas */}
            <path d={areaDifference} fill="url(#diffGradient)" />

            {/* Linha A: Cenário Atual (cinza tracejada) */}
            <path
              d={pathCurrent}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeLinecap="round"
            />

            {/* Linha B: Cenário Otimizado (esmeralda brilhante contínua) */}
            <path
              d={pathOptimized}
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* Pontos nos marcos */}
            {points.map((p, idx) => {
              const isHovered = hoveredIndex === idx;
              return (
                <g key={p.monthNum}>
                  <circle
                    cx={p.x}
                    cy={p.yOptimized}
                    r="12"
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onTouchStart={() => setHoveredIndex(idx)}
                  />
                  <circle
                    cx={p.x}
                    cy={p.yOptimized}
                    r={isHovered ? '5' : '3.5'}
                    fill="#10b981"
                    stroke="#090e17"
                    strokeWidth="2"
                  />
                  <circle
                    cx={p.x}
                    cy={p.yCurrent}
                    r={isHovered ? '4' : '2.5'}
                    fill="#94a3b8"
                  />
                </g>
              );
            })}

            {/* Labels do eixo X */}
            {points.map((p) => (
              <text
                key={p.monthNum}
                x={p.x}
                y={height - 8}
                textAnchor="middle"
                className="text-[10px] fill-muted-foreground font-mono"
              >
                {p.label}
              </text>
            ))}
          </svg>

          {/* Tooltip Dinâmico Interativo */}
          {hoveredIndex !== null && points[hoveredIndex] && (
            <div
              className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-xl p-3 text-xs animate-fade-in whitespace-nowrap"
              style={{
                left: `${(points[hoveredIndex].x / width) * 100}%`,
                top: `${(points[hoveredIndex].yOptimized / height) * 100}%`,
              }}
            >
              <div className="font-bold text-foreground mb-1">
                {points[hoveredIndex].label}
              </div>
              <div className="flex items-center gap-1.5 text-emerald-500 font-semibold font-mono">
                <span>Com IA: {formatCurrency(points[hoveredIndex].optimizedBalance)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-mono">
                <span>Sem IA: {formatCurrency(points[hoveredIndex].currentBalance)}</span>
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 border-t border-border/50 pt-1 mt-1 font-bold">
                +{formatCurrency(points[hoveredIndex].difference)} poupados
              </div>
            </div>
          )}
        </div>

        {/* Legenda de Rodapé */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#94a3b8] border-dashed" />
              <span>Cenário Atual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-[#10b981] rounded-full" />
              <span className="text-emerald-500 font-medium">Cenário com IA</span>
            </div>
          </div>

          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Cálculo baseado nas oportunidades de corte detectadas
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
