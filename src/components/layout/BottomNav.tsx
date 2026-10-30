'use client';

import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  Plus,
  Sparkles,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type BottomNavTab = 'dashboard' | 'transactions' | 'insights' | 'settings';

export interface BottomNavProps {
  activeTab?: BottomNavTab;
  onSelectTab?: (tab: BottomNavTab) => void;
  onOpenNewTransaction?: () => void;
  hasUnreadInsights?: boolean;
}

export function BottomNav({
  activeTab = 'dashboard',
  onSelectTab,
  onOpenNewTransaction,
  hasUnreadInsights = true,
}: BottomNavProps) {

  return (
    <nav
      aria-label="Navegação móvel inferior"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-lg border-t border-border/70 pb-[env(safe-area-inset-bottom)] shadow-lg shadow-black/10"
    >
      <div className="flex items-center justify-around h-16 px-2 relative">
        {/* Item 1: Métricas */}
        <button
          type="button"
          onClick={() => onSelectTab?.('dashboard')}
          aria-label="Métricas e Indicadores"
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 transition-colors',
            activeTab === 'dashboard'
              ? 'text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-tight font-medium">Métricas</span>
        </button>

        {/* Item 2: Extrato */}
        <button
          type="button"
          onClick={() => onSelectTab?.('transactions')}
          aria-label="Extrato Financeiro"
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 transition-colors',
            activeTab === 'transactions'
              ? 'text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Receipt className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-tight font-medium">Extrato</span>
        </button>

        {/* Central Prominent CTA Button: Novo Lançamento */}
        <div className="flex-1 flex justify-center -mt-6">
          <button
            type="button"
            onClick={onOpenNewTransaction}
            aria-label="Adicionar novo lançamento"
            className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 hover:scale-105 active:scale-95 transition-all focus-ring p-3 border-4 border-background cursor-pointer"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Item 3: Insights IA */}
        <button
          type="button"
          onClick={() => onSelectTab?.('insights')}
          aria-label="Insights da IA"
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 relative transition-colors',
            activeTab === 'insights'
              ? 'text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 mb-0.5" />
            {hasUnreadInsights && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            )}
          </div>
          <span className="text-[11px] leading-tight font-medium">Insights</span>
        </button>

        {/* Item 4: Ajustes */}
        <button
          type="button"
          onClick={() => onSelectTab?.('settings')}
          aria-label="Ajustes e Conexão WhatsApp"
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 transition-colors',
            activeTab === 'settings'
              ? 'text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-tight font-medium">Ajustes</span>
        </button>
      </div>
    </nav>
  );
}
