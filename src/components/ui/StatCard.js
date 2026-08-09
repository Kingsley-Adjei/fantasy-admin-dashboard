'use client';
import { useEffect, useRef } from 'react';

function countUp(el, end, duration = 1000) {
  const start = 0;
  const startTime = performance.now();
  const step = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const val = Math.floor(progress * end);
    el.textContent = val.toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = end.toLocaleString();
  };
  requestAnimationFrame(step);
}

export default function StatCard({ icon: Icon, label, value, badge, badgeClass = 'badge-green', iconBg = 'var(--surface-3)', delay = 0 }) {
  const valRef = useRef(null);
  const numericVal = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  const suffix = String(value).replace(/[0-9.,]/g, '').trim();

  useEffect(() => {
    if (!valRef.current || isNaN(numericVal)) return;
    const timer = setTimeout(() => {
      countUp(valRef.current, numericVal, 900);
    }, delay);
    return () => clearTimeout(timer);
  }, [numericVal, delay]);

  return (
    <div className="stat-card animate-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="stat-card-header">
        <div className="stat-card-icon" style={{ background: iconBg }}>
          <Icon size={18} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
        </div>
        {badge && (
          <span className={`stat-card-badge ${badgeClass}`}>{badge}</span>
        )}
      </div>
      <div>
        <div className="stat-card-value font-syne">
          {isNaN(numericVal) ? value : (
            <>
              <span ref={valRef}>0</span>
              {suffix && <span style={{ fontSize: 18 }}>{suffix}</span>}
            </>
          )}
        </div>
        <div className="stat-card-label">{label}</div>
      </div>
    </div>
  );
}
