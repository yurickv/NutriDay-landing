'use client';
import React from 'react';
import { useRouter } from 'next/navigation';

interface BackButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export const BackButton: React.FC<BackButtonProps> = ({
  className = '',
  children,
}) => {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        try {
          if (
            typeof window !== 'undefined' &&
            window.history &&
            window.history.length > 1
          ) {
            router.back();
          } else {
            router.push('/payment/plan');
          }
        } catch {
          router.push('/payment/plan');
        }
      }}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 transition ${className}`}
    >
      {/* Left arrow */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="w-4 h-4"
      >
        <path
          fillRule="evenodd"
          d="M12.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L8.414 10l4.293 4.293a1 1 0 010 1.414z"
          clipRule="evenodd"
        />
      </svg>
      {children ?? 'Назад'}
    </button>
  );
};
