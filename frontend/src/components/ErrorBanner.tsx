import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import './ErrorBanner.css';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
}

export function ErrorBanner({ message, onRetry, action, className = '' }: ErrorBannerProps) {
  return (
    <div className={`error-banner ${className}`} role="alert">
      <AlertCircle size={16} className="error-banner-icon" />
      <span className="error-banner-msg">{message}</span>
      {onRetry && (
        <button className="error-banner-retry" onClick={onRetry}>
          Retry
        </button>
      )}
      {action}
    </div>
  );
}
