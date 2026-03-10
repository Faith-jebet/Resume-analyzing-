import React from 'react';
import { cn } from '../lib/utils';

export function Card({ children, className }) {
  return (
    <div className={cn("glass-card", className)}>
      {children}
    </div>
  );
}
