import { Construction } from 'lucide-react';
import './Placeholder.css';

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="placeholder-page" style={{ animation: 'pageEnter var(--dur-slow) var(--ease-out) backwards' }}>
      <div className="placeholder-card">
        <div className="placeholder-icon">
          <Construction size={28} strokeWidth={1.5} />
        </div>
        <h1 className="placeholder-title">{title}</h1>
        <p className="placeholder-desc">
          This section is under active development and will be available soon.
        </p>
        <div className="placeholder-badge">Coming soon</div>
      </div>
    </div>
  );
}
