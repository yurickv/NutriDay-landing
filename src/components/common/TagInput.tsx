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
      className="flex flex-wrap gap-1.5 p-2 min-h-[44px] rounded-xl border border-ink/10 dark:border-night-ink/10 bg-card dark:bg-night-card cursor-text transition-colors focus-within:border-sage focus-within:ring-2 focus-within:ring-sage-light/50"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sage-light/40 dark:bg-sage/20 text-xs font-medium text-sage-dark dark:text-sage-light"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(i); }}
              className="text-sage-dark/60 dark:text-sage-light/60 hover:text-danger dark:hover:text-danger-dark transition-colors"
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
          className="flex-1 min-w-[100px] bg-transparent text-xs text-ink dark:text-night-ink placeholder:text-ink/40 dark:placeholder:text-night-muted outline-none py-1 px-1"
        />
      )}
    </div>
  );
}
