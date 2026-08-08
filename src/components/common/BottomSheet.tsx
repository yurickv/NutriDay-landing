'use client';

import { Dialog, DialogPanel, DialogBackdrop } from '@headlessui/react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
      />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <DialogPanel className="w-full max-w-lg bg-card dark:bg-night-card rounded-t-3xl sm:rounded-3xl max-h-[85vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transform transition-transform duration-300">
          {/* Handle bar (mobile only) */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0 sm:hidden">
            <div className="w-10 h-1 bg-ink/20 dark:bg-night-muted/40 rounded-full" />
          </div>

          {/* Header */}
          {title && (
            <div className="flex items-center justify-between px-5 py-3 border-b border-ink/10 dark:border-night-ink/10 flex-shrink-0">
              <h2 className="text-base font-heading font-semibold text-ink dark:text-night-ink">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-cream dark:hover:bg-night text-ink/40 dark:text-night-muted"
                aria-label="Закрити"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Content */}
          <div className="overflow-y-auto flex-1 overscroll-contain">
            {children}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
