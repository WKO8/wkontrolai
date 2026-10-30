import React from 'react';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Carregando dados do painel...">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="h-7 w-48 bg-muted rounded-lg mb-2" />
          <div className="h-4 w-72 bg-muted/60 rounded" />
        </div>
        <div className="h-10 w-36 bg-muted rounded-xl" />
      </div>

      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 rounded-2xl border border-border bg-card">
            <div className="flex justify-between items-center mb-3">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-8 w-8 bg-muted rounded-xl" />
            </div>
            <div className="h-8 w-36 bg-muted rounded-lg mb-3" />
            <div className="h-3 w-28 bg-muted/60 rounded" />
          </div>
        ))}
      </div>

      {/* AI Insights Skeleton */}
      <div className="p-6 rounded-2xl border border-border bg-card">
        <div className="h-5 w-44 bg-muted rounded mb-4" />
        <div className="space-y-3">
          <div className="h-20 bg-muted/50 rounded-xl" />
          <div className="h-20 bg-muted/50 rounded-xl" />
        </div>
      </div>

      {/* Main Grid: Chart & Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 p-6 rounded-2xl border border-border bg-card">
          <div className="h-5 w-40 bg-muted rounded mb-6" />
          <div className="h-56 w-56 mx-auto rounded-full bg-muted/50" />
        </div>
        <div className="lg:col-span-7 p-6 rounded-2xl border border-border bg-card">
          <div className="h-5 w-44 bg-muted rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted/40 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
