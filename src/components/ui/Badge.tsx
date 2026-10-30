import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'destructive' | 'warning' | 'ai';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variantStyles = {
    default: 'bg-primary/10 text-primary border-primary/20',
    secondary: 'bg-muted text-muted-foreground border-transparent',
    outline: 'text-foreground border-border',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    destructive: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    ai: 'bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-indigo-500/10 text-emerald-600 dark:text-cyan-300 border-cyan-500/20',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
