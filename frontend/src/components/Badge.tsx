import type { ReactNode } from 'react';
import './Badge.css';

type BadgeVariant = 'default' | 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'gray';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

const variantClass: Record<BadgeVariant, string> = {
  default: 'badge--default',
  green: 'badge--green',
  blue: 'badge--blue',
  amber: 'badge--amber',
  red: 'badge--red',
  purple: 'badge--purple',
  gray: 'badge--gray',
};

export function Badge({ variant = 'default', children, dot, pulse, className = '' }: BadgeProps) {
  return (
    <span className={`badge ${variantClass[variant]} ${className}`}>
      {dot && <span className={`badge-dot ${pulse ? 'badge-dot--pulse' : ''}`} />}
      {children}
    </span>
  );
}
