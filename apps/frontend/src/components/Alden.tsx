import { type ReactNode, useState, useEffect } from "react";

export function Pill({ children, variant = "default", style }: { children: ReactNode; variant?: "default" | "accent" | "success" | "warning" | "danger"; style?: React.CSSProperties }) {
  const cls = variant === "default" ? "" : ` zl-badge--${variant}`;
  return <span className={`zl-badge${cls}`} style={style}>{children}</span>;
}

export function Button({ children, onClick, disabled, variant = "primary", size, type = "button", className, style }: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  size?: "sm";
  type?: "button" | "submit";
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`zl-btn zl-btn--${variant} ${size === "sm" ? "zl-btn--sm" : ""} ${className ?? ""}`} style={style}>
      {children}
    </button>
  );
}

export function Address({ value, truncate = true }: { value: string; truncate?: boolean }) {
  const display = truncate ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
  return <span className="zl-code" title={value}>{display}</span>;
}

export function Money({ value, token = "USDC" }: { value: string; token?: "USDC" | "ZERO" }) {
  const decimals = token === "USDC" ? 6 : 18;
  const num = Number(value) / 10 ** decimals;
  return <span>{num.toLocaleString(undefined, { maximumFractionDigits: 2 })} {token}</span>;
}

export function Countdown({ to, label }: { to: string | number; label?: string }) {
  const target = typeof to === "string" ? Number(to) : to;
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = Math.max(0, Math.floor((target * 1000 - now) / 1000));
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const text = `${d > 0 ? `${d}d ` : ""}${h > 0 ? `${h}h ` : ""}${m}m ${s}s`;
  return <span title={label}>{text}</span>;
}

export function Empty({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="zl-empty">
      <h3>{title}</h3>
      {description && <p style={{ color: "var(--color-graphite)", maxWidth: 480, margin: "8px auto 0" }}>{description}</p>}
      {action && <div style={{ marginTop: 24 }}>{action}</div>}
    </div>
  );
}

export function LoadingRows({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="zl-skeleton" style={{ height: 72, width: "100%" }} />
      ))}
    </div>
  );
}

export function ErrorPane({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="zl-empty">
      <h3>Something went wrong</h3>
      <p style={{ color: "var(--color-graphite)" }}>{message}</p>
      {retry && <div style={{ marginTop: 24 }}><Button onClick={retry}>Retry</Button></div>}
    </div>
  );
}
