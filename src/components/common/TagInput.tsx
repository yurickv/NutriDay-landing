'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
}

export function TagInput({ tags, onChange, placeholder = 'Додати...', maxTags = 20, disabled = false }: TagInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(value: string) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || tags.includes(trimmed) || tags.length >= maxTags) return;
    onChange([...tags, trimmed]);
    setInput('');
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 p-2 min-h-[44px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 text-xs font-medium text-orange-700 dark:text-orange-300"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(i); }}
              className="text-orange-400 hover:text-orange-600 dark:hover:text-orange-200 transition-colors"
              aria-label={`Видалити ${tag}`}
            >
              <X size={11} />
            </button>
          )}
        </span>
      ))}
      {!disabled && tags.length < maxTags && (
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (input.trim()) addTag(input); }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] bg-transparent text-xs text-neutral-700 dark:text-neutral-300 placeholder:text-neutral-400 outline-none py-1 px-1"
        />
      )}
    </div>
  );
}
