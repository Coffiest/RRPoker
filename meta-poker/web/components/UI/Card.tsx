import { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export function Card({ children, className = '', glow = false, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`
        bg-[#141414] border border-[#2A2A2A]
        rounded-[20px] p-5
        ${glow ? 'shadow-[0_0_20px_rgba(242,169,0,0.12)] border-[#F2A900]/20' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
