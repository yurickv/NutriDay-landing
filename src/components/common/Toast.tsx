'use client';

import { useEffect, useState } from 'react';

export interface ToastData {
  id: string;
  message: string;
  type?: 'success' | 'info' | 'error';
  emoji?: string;
}

interface ToastProps {
  toast: ToastData;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 300);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const colorClasses =
    toast.type === 'error'
      ? 'bg-danger text-card'
      : toast.type === 'info'
      ? 'bg-sage text-card'
      : 'bg-ink text-card dark:bg-card dark:text-ink';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-soft max-w-sm transition-all duration-300 ${colorClasses} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {toast.emoji && <span className="text-xl" aria-hidden="true">{toast.emoji}</span>}
      <p className="text-sm font-semibold">{toast.message}</p>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-24 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}
