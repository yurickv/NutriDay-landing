'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogPanel, DialogBackdrop } from '@headlessui/react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Headless UI закриває діалог уже на pointerup/touchend. Якщо бекдроп зникає миттєво,
 * подія click після відпускання пальця влучає в елемент під ним (картку страви, кнопку).
 * Тому після закриття перехоплюємо один наступний click на фазі capture.
 */
const CLICK_SHIELD_MS = 350;

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  // cleanup активного перехоплювача (слухач + таймер), щоб повторне закриття не лишало витоку
  const shieldCleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => shieldCleanup.current?.(), []);

  const handleClose = useCallback(() => {
    if (typeof document !== 'undefined') {
      shieldCleanup.current?.();
      const swallow = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        cleanup();
      };
      const timer = setTimeout(() => cleanup(), CLICK_SHIELD_MS);
      const cleanup = () => {
        document.removeEventListener('click', swallow, true);
        clearTimeout(timer);
        if (shieldCleanup.current === cleanup) shieldCleanup.current = null;
      };
      // Синхронно: Headless UI закриває на pointerup/touchend, а click іде наступною задачею —
      // setTimeout(0) може програти цю гонку. Поточну подію (клік по «Закрити» всередині шторки)
      // новий capture-слухач на document уже не отримає, бо фаза capture для неї минула.
      document.addEventListener('click', swallow, true);
      shieldCleanup.current = cleanup;
    }
    onClose();
  }, [onClose]);

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <DialogPanel
          transition
          className="w-full max-w-lg bg-card dark:bg-night-card rounded-t-3xl sm:rounded-3xl max-h-[85vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transform transition duration-300 ease-out data-[closed]:translate-y-full sm:data-[closed]:translate-y-0 sm:data-[closed]:opacity-0 sm:data-[closed]:scale-95"
        >
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
