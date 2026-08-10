import './Spinner.css';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'spinner--sm',
  md: 'spinner--md',
  lg: 'spinner--lg',
};

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return <span className={`spinner-wrap ${sizeMap[size]} ${className}`} role="status" aria-label="Loading" />;
}
