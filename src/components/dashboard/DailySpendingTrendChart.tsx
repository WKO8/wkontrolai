'use client';

import React, { useState, useMemo } from 'react';
import { TrendingDown, Calendar, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { formatCurrency, cn } from '@/lib/utils';
import type { TransactionEntity } from '@/types';

export interface DailySpendingTrendChartProps {
  transactions: TransactionEntity[];
  period: string; // 'YYYY-MM'
  isLoading?: boolean;
}

export function DailySpendingTrendChart({
  transactions,
  period,
  isLoading = false,
}: DailySpendingTrendChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    day: number;
    amount: number;
    date: string;
    x: number;
    y: number;
  } | null>(null);

  // Determina quantos dias tem o mês
  const daysInMonth = useMemo(() => {
    try {
      const [yearStr, monthStr] = period.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      if (isNaN(year) || isNaN(month)) return 30;
      return new Date(year, month, 0).getDate();
    } catch {
      return 30;
    }
  }, [period]);

  // Agrega gastos por dia do mês
  const dailyData = useMemo(() => {
    const map = new Map<number, number>();
    for (let d = 1; d <= daysInMonth; d++) {
      map.set(d, 0);
    }

    transactions
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => {
        try {
          const parts = t.transactionDate.split('-');
          const day = parseInt(parts[2], 10);
          if (day >= 1 && day <= daysInMonth) {
            const val = parseFloat(t.amount) || 0;
            map.set(day, (map.get(day) || 0) + val);
          }
        } catch {
          // data inválida
        }
      });

    return Array.from(map.entries()).map(([day, amount]) => ({
      day,
      amount,
      date: `${period}-${String(day).padStart(2, '0')}`,
    }));
  }, [transactions, daysInMonth, period]);

  const maxAmount = useMemo(() => {
    const max = Math.max(...dailyData.map((d) => d.amount), 0);
    return max > 0 ? max * 1.15 : 100;
  }, [dailyData]);

  const totalExpense = useMemo(() => {
    return dailyData.reduce((acc, curr) => acc + curr.amount, 0);
  }, [dailyData]);

  const peakDay = useMemo(() => {
    if (totalExpense === 0) return null;
    return dailyData.reduce((prev, curr) => (curr.amount > prev.amount ? curr : prev));
  }, [dailyData, totalExpense]);

  // Geometria SVG
  const width = 800;
  const height = 180;
  const paddingX = 24;
  const paddingBottom = 30;
  const paddingTop = 20;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;

  // Pontos de coordenadas (x, y)
  const points = useMemo(() => {
    return dailyData.map((d, i) => {
      const x = paddingX + (i / Math.max(1, dailyData.length - 1)) * chartWidth;
      const y = paddingTop + chartHeight - (d.amount / maxAmount) * chartHeight;
      return { ...d, x, y };
    });
  }, [dailyData, chartWidth, chartHeight, maxAmount, paddingX, paddingTop]);

  // Curva de spline suave SVG
  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpx = (p0.x + p1.x) / 2;
      d += ` C ${cpx} ${p0.y}, ${cpx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  }, [points]);

  // Área preenchida com gradiente fechando no eixo X inferior
  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    const bottomY = paddingTop + chartHeight;
    return `${pathD} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
  }, [pathD, points, paddingTop, chartHeight]);

  if (isLoading) {
    return (
      <Card className="p-6 animate-pulse border-border/80">
        <div className="h-5 w-48 bg-muted rounded mb-3" />
        <div className="h-44 bg-muted/40 rounded-xl" />
      </Card>
    );
  }

  return (
    <Card className="border-border/80 overflow-hidden relative">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-emerald-500" />
            Tendência Diária de Gastos
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Evolução do desembolso dia a dia ao longo do período
          </span>
        </div>

        {peakDay && peakDay.amount > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <span>Pico: Dia {peakDay.day} ({formatCurrency(peakDay.amount)})</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-4">
        {totalExpense === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-foreground">Sem dados de despesas neste período</p>
            <p className="text-xs text-muted-foreground">Novos lançamentos criarão a curva diária automaticamente.</p>
          </div>
        ) : (
          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-44 sm:h-52 select-none"
              role="img"
              aria-label="Gráfico de tendência de gastos diários"
            >
              <defs>
                <linearGradient id="emeraldAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity="0.4" />
                  <stop offset="95%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Linhas horizontais de referência */}
              <line
                x1={paddingX}
                y1={paddingTop}
                x2={width - paddingX}
                y2={paddingTop}
                stroke="currentColor"
                className="text-border/40"
                strokeDasharray="3 3"
              />
              <line
                x1={paddingX}
                y1={paddingTop + chartHeight / 2}
                x2={width - paddingX}
                y2={paddingTop + chartHeight / 2}
                stroke="currentColor"
                className="text-border/40"
                strokeDasharray="3 3"
              />
              <line
                x1={paddingX}
                y1={paddingTop + chartHeight}
                x2={width - paddingX}
                y2={paddingTop + chartHeight}
                stroke="currentColor"
                className="text-border/80"
              />

              {/* Área com gradiente */}
              <path d={areaD} fill="url(#emeraldAreaGradient)" />

              {/* Linha da curva principal */}
              <path
                d={pathD}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Pontos interativos */}
              {points.map((p) => {
                const isHovered = hoveredPoint?.day === p.day;
                const isPeak = peakDay?.day === p.day && p.amount > 0;
                return (
                  <g key={p.day}>
                    {/* Hitbox maior para toque */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="12"
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPoint(p)}
                      onTouchStart={() => setHoveredPoint(p)}
                    />
                    {(isHovered || isPeak) && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? '5' : '3.5'}
                        fill={isPeak ? '#34d399' : '#10b981'}
                        stroke="#090e17"
                        strokeWidth="2"
                        className="transition-all pointer-events-none"
                      />
                    )}
                  </g>
                );
              })}

              {/* Rótulos do Eixo X (Dias 1, 5, 10, 15, 20, 25, final) */}
              {[1, 5, 10, 15, 20, 25, daysInMonth].map((dayNum) => {
                const idx = dayNum - 1;
                const pt = points[idx];
                if (!pt) return null;
                return (
                  <text
                    key={dayNum}
                    x={pt.x}
                    y={height - 8}
                    textAnchor="middle"
                    className="text-[10px] fill-muted-foreground font-mono"
                  >
                    D{dayNum}
                  </text>
                );
              })}
            </svg>

            {/* Tooltip Dinâmico em Glassmorphism */}
            {hoveredPoint && (
              <div
                className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-xl px-3 py-2 text-xs transition-all animate-fade-in"
                style={{
                  left: `${(hoveredPoint.x / width) * 100}%`,
                  top: `${(hoveredPoint.y / height) * 100}%`,
                }}
              >
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-primary" />
                  <span>Dia {hoveredPoint.day} de {period}</span>
                </div>
                <div className="text-emerald-500 font-bold font-mono mt-0.5">
                  {formatCurrency(hoveredPoint.amount)}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
