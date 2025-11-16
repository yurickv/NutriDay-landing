// components/onboarding/RadioButton.tsx
import React from 'react';

interface RadioButtonProps {
  id: string;
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: (value: string) => void;
  onSelect?: () => void; // Add onSelect for immediate navigation
}

export const RadioButton: React.FC<RadioButtonProps> = ({
  id,
  name,
  value,
  label,
  checked,
  onChange,
  onSelect,
}) => {
  const handleClick = () => {
    onChange(value);
    if (onSelect) {
      setTimeout(onSelect, 150); // Small delay for visual feedback
    }
  };

  return (
    <div className='mb-3'>
      <label
        htmlFor={id}
        className={`cursor-pointer flex items-center p-4 rounded-xl transition-all duration-200
          hover:bg-[#ECECEC] dark:hover:bg-[#d4d4d4] dark:hover:text-main-text
          ${
            checked
              ? 'bg-[#D9D9D9] dark:bg-[#d4d4d4] text-main shadow-md'
              : 'bg-[#F5F5F5] dark:bg-[#676465] dark:text-main-text-black'
          }`}
      >
        <input
          id={id}
          name={name}
          type='radio'
          value={value}
          checked={checked}
          onChange={handleClick}
          className='appearance-none'
        />
        <span className='text-lg font-semibold'>{label}</span>
      </label>
    </div>
  );
};
