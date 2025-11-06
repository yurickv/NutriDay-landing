// components/onboarding/CheckboxButton.tsx
import React from 'react';

interface CheckboxButtonProps {
  id: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: (value: string, checked: boolean) => void;
}

export const CheckboxButton: React.FC<CheckboxButtonProps> = ({
  id,
  value,
  label,
  checked,
  onChange,
}) => {
  return (
    <div className='mb-3'>
      <label
        htmlFor={id}
        className={`cursor-pointer flex items-center gap-3 p-4 rounded-xl transition-all duration-200
          hover:bg-[#ECECEC] dark:hover:bg-[#d4d4d4] dark:hover:text-main-text
          ${
            checked
              ? 'bg-[#D9D9D9] dark:bg-[#d4d4d4] text-main shadow-md'
              : 'bg-[#F5F5F5] dark:bg-[#676465] dark:text-main-text-black'
          }`}
      >
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all
          ${
            checked
              ? 'bg-orange-500 border-orange-500'
              : 'bg-white dark:bg-gray-700 border-gray-400 dark:border-gray-500'
          }`}
        >
          {checked && (
            <svg
              className='w-3 h-3 text-white'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                clipRule='evenodd'
              />
            </svg>
          )}
        </div>
        <input
          id={id}
          type='checkbox'
          value={value}
          checked={checked}
          onChange={(e) => onChange(value, e.target.checked)}
          className='sr-only'
        />
        <span className='text-lg font-semibold flex-1'>{label}</span>
      </label>
    </div>
  );
};
