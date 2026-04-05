import React from 'react';
import { cn } from '../lib/utils';

export function Card({ children, className }) {
  return (
    <div className={cn("rounded-xl border border-white/10", className)}>
      {children}
    </div>
  );
}