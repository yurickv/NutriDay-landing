'use client';

import { ReactNode } from 'react';

interface CollapsibleProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Smoothly animates its children open/closed using the CSS grid
 * `grid-template-rows: 0fr -> 1fr` trick, so no height measurement is needed.
 * Children stay mounted (form state is preserved) but are hidden from
 * assistive tech and keyboard focus while collapsed.
 */
export function Collapsible({ open, children, className = '' }: CollapsibleProps) {
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      }`}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={`transition-opacity duration-300 motion-reduce:transition-none ${
            open ? 'opacity-100' : 'opacity-0'
          } ${className}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
