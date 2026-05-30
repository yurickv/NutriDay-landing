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
        <DialogPanel className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-t-3xl sm:rounded-3xl max-h-[85vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transform transition-transform duration-300">
          {/* Handle bar (mobile only) */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0 sm:hidden">
            <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
          </div>

          {/* Header */}
          {title && (
            <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 dark:border-neutral-800 flex-shrink-0">
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
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
