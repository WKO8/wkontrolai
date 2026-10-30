'use client';

import React from 'react';
import {
  Sparkles,
  Plus,
  Moon,
  Sun,
  Smartphone,
  Calendar,
  ChevronDown,
  Bell,
  Link2,
  LayoutDashboard,
  Receipt,
} from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatPhoneDisplay } from '@/lib/utils/phone';
import { cn } from '@/lib/utils';
import type { BottomNavTab } from '@/components/layout/BottomNav';

export interface NavbarProps {
  activeTab?: BottomNavTab;
  onSelectTab?: (tab: BottomNavTab) => void;
  onOpenNewTransaction?: () => void;
  onOpenPairing?: () => void;
  selectedPeriod?: string;
  onPeriodChange?: (period: string) => void;
  whatsappPhone?: string | null;
}

export function Navbar({
  activeTab = 'dashboard',
  onSelectTab,
  onOpenNewTransaction,
  onOpenPairing,
  selectedPeriod = '2026-10',
  onPeriodChange,
  whatsappPhone,
}: NavbarProps) {
  const { resolvedTheme, toggleTheme } = useTheme();

  const periods = [
    { value: '2026-10', label: 'Outubro 2026 (Atual)' },
    { value: '2026-09', label: 'Setembro 2026' },
    { value: '2026-08', label: 'Agosto 2026' },
    { value: 'last-90-days', label: 'Últimos 90 dias' },
    { value: 'all', label: 'Todos os períodos' },
  ];

  const formattedPhone = whatsappPhone ? formatPhoneDisplay(whatsappPhone) : null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-950 via-slate-900 to-primary-800 border border-primary-500/30 shadow-sm shadow-primary/20">
            <span className="font-extrabold text-lg text-emerald-400 tracking-tighter">W</span>
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-foreground">
                WKontrol<span className="text-primary font-black">AI</span>
              </span>
              <Badge variant="ai" className="hidden sm:inline-flex py-0 px-1.5 text-[10px]">
                <Sparkles className="w-2.5 h-2.5 text-emerald-500" />
                IA Ativa
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground hidden 2xl:inline-block leading-none">
              Gestão Financeira Multimodal
            </span>
          </div>
        </div>

        {/* Center / Desktop Segmented Screen Tabs */}
        <nav
          aria-label="Navegação desktop"
          className="hidden md:flex items-center p-1 bg-secondary/80 border border-border/70 rounded-2xl gap-1 shadow-inner whitespace-nowrap shrink-0"
        >
          <button
            type="button"
            onClick={() => onSelectTab?.('dashboard')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all focus-ring cursor-pointer whitespace-nowrap shrink-0',
              activeTab === 'dashboard'
                ? 'bg-emerald-500 text-white font-semibold shadow-sm shadow-emerald-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70'
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Métricas</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab?.('transactions')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all focus-ring cursor-pointer whitespace-nowrap shrink-0',
              activeTab === 'transactions'
                ? 'bg-emerald-500 text-white font-semibold shadow-sm shadow-emerald-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70'
            )}
          >
            <Receipt className="w-4 h-4" />
            <span>Extrato</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab?.('insights')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all focus-ring cursor-pointer whitespace-nowrap shrink-0 relative',
              activeTab === 'insights'
                ? 'bg-emerald-500 text-white font-semibold shadow-sm shadow-emerald-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70'
            )}
          >
            <Sparkles className={cn('w-4 h-4', activeTab === 'insights' ? 'text-white' : 'text-emerald-400')} />
            <span>Insights & IA</span>
          </button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Period Selector */}
          <div className="relative hidden sm:inline-flex items-center shrink-0">
            <Calendar className="w-4 h-4 text-muted-foreground absolute left-3 pointer-events-none" />
            <select
              value={selectedPeriod}
              onChange={(e) => onPeriodChange?.(e.target.value)}
              aria-label="Selecionar período"
              className="h-9 pl-9 pr-8 text-xs sm:text-sm font-medium bg-secondary/70 hover:bg-secondary text-foreground border border-border/80 rounded-xl appearance-none cursor-pointer focus-ring transition-colors"
            >
              {periods.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 pointer-events-none" />
          </div>

          {/* WhatsApp Status Indicator / Pairing Button */}
          {formattedPhone ? (
            <button
              type="button"
              onClick={onOpenPairing}
              className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 font-medium transition-colors focus-ring cursor-pointer shrink-0"
              title={`WhatsApp conectado: ${formattedPhone}. Clique para gerenciar o vínculo.`}
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate max-w-[105px] 2xl:max-w-none font-mono text-[11px] sm:text-xs">
                {formattedPhone}
              </span>
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenPairing}
              className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-semibold text-amber-600 dark:text-amber-400 transition-colors focus-ring cursor-pointer shrink-0"
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span>Vincular</span>
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            </button>
          )}

          {/* Mobile Quick Pairing Button if not paired */}
          {!formattedPhone && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenPairing}
              className="xl:hidden text-xs gap-1 h-8 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5 shrink-0"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Vincular</span>
            </Button>
          )}

          {/* Quick Notification Bell */}
          <button
            type="button"
            aria-label="Notificações"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border transition-colors focus-ring shrink-0"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Alternar para modo ${resolvedTheme === 'dark' ? 'claro' : 'escuro'}`}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border transition-colors focus-ring shrink-0"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* New Transaction Button (Desktop/Tablet) */}
          <Button
            onClick={onOpenNewTransaction}
            className="hidden sm:inline-flex shadow-md shadow-primary/25 shrink-0"
            size="sm"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="hidden xl:inline">Novo Lançamento</span>
            <span className="xl:hidden">Novo</span>
          </Button>

          {/* User Avatar */}
          <div
            onClick={onOpenPairing}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-900 border border-border flex items-center justify-center font-bold text-xs text-foreground cursor-pointer select-none hover:ring-2 hover:ring-primary/40 transition-all shrink-0"
            title={formattedPhone ? `Conta conectada (${formattedPhone})` : 'Clique para vincular sua conta'}
          >
            WK
          </div>
        </div>
      </div>
    </header>
  );
}
