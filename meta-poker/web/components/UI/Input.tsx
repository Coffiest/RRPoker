'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-[#A0A0A0] tracking-wide uppercase">
            {label}
          </label>
        )}
        <input
          ref={ref}
          {...props}
          className={`
            w-full px-4 py-3 rounded-xl
            bg-[#1C1C1C] border
            text-white placeholder:text-[#606060]
            focus:outline-none transition-all duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error
              ? 'border-[#FF3B30] focus:border-[#FF3B30]'
              : 'border-[#2A2A2A] focus:border-[#F2A900] focus:bg-[#1F1F1F]'
            }
            ${className}
          `}
        />
        {error && <p className="text-xs text-[#FF3B30]">{error}</p>}
        {hint && !error && <p className="text-xs text-[#606060]">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
