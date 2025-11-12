"use client";
import React from 'react';

interface ScrollTopButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export const ScrollTopButton: React.FC<ScrollTopButtonProps> = ({ className = '', children }) => {
  const onClick = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition ${className}`}
    >
      {children ?? 'Вверх'}
      {/* Up arrow */}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l5 5a1 1 0 01-1.414 1.414L11 6.414V16a1 1 0 11-2 0V6.414L5.707 9.707A1 1 0 114.293 8.293l5-5A1 1 0 0110 3z" clipRule="evenodd" />
      </svg>
    </button>
  );
};

