"use client";

import { Children, cloneElement, isValidElement, useId } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";
import { CATS, CERTS } from "@/lib/catalog";
import { expTxt } from "@/lib/format";
import type { CertDTO, Ratings } from "@/lib/types";

/** Las cuatro marcas de registro "+" de un objeto de plano. */
export function Corners() {
  return (
    <>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </>
  );
}

type BlueprintProps = {
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & Record<string, unknown>;

export function Blueprint({ as: Tag = "div", className = "", children, ...rest }: BlueprintProps) {
  return (
    <Tag className={"blueprint " + className} {...rest}>
      <Corners />
      {children}
    </Tag>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={"btn btn-primary blueprint " + className} {...rest}>
      <Corners />
      {children}
    </button>
  );
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
  labels,
  size,
  ariaLabel,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: readonly string[];
  size?: "sm" | "xs";
  ariaLabel?: string;
}) {
  return (
    <div className={"segbar " + (size ?? "")} role="group" aria-label={ariaLabel}>
      {options.map((o, i) => (
        <button key={o} type="button" aria-pressed={o === value} onClick={() => onChange(o)}>
          {labels ? labels[i] : o}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T[];
  onChange: (v: T[]) => void;
  label?: (o: T) => string;
}) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            className="chip"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
          >
            {label ? label(o) : o}
          </button>
        );
      })}
    </div>
  );
}

/** Etiqueta + control. Si el primer hijo es un input/select/textarea, la etiqueta se asocia a él. */
export function Field({ label, children, style, className }: { label: string; children: ReactNode; style?: CSSProperties; className?: string }) {
  const id = useId();
  const kids = Children.toArray(children);
  const first = kids[0];
  const linkable = isValidElement<{ id?: string }>(first) && typeof first.type === "string" && ["input", "select", "textarea"].includes(first.type);
  const fieldId = linkable ? (first.props.id ?? id) : undefined;
  return (
    <div className={"field " + (className ?? "")} style={style}>
      <label htmlFor={fieldId}>{label}</label>
      {linkable ? [cloneElement(first, { id: fieldId, key: "control" }), ...kids.slice(1)] : children}
    </div>
  );
}

export function KV({ k, v, size = 26 }: { k: string; v: ReactNode; size?: number }) {
  return (
    <div>
      <div className="label">{k}</div>
      <div className="figure" style={{ fontSize: size }}>{v}</div>
    </div>
  );
}

export function CatBars({ r, labelWidth = 64, lg }: { r: Ratings; labelWidth?: number; lg?: boolean }) {
  return (
    <div className="stack" style={{ gap: lg ? 10 : 5 }}>
      {CATS.map((c, k) => (
        <div
          key={c}
          style={{ display: "grid", gridTemplateColumns: `${labelWidth}px 1fr 28px`, alignItems: "center", gap: lg ? 10 : 8, fontSize: lg ? 13 : 12 }}
        >
          <span className={lg ? "" : "muted"}>{c}</span>
          <div className={"bar" + (lg ? " lg" : "")}>
            <div style={{ width: (r[k] / 5) * 100 + "%" }} />
          </div>
          <span className="num" style={{ textAlign: "right" }}>{r[k].toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

export function CertLogo({ cert, size }: { cert: Pick<CertDTO, "id" | "logo">; size?: number }) {
  const s = size ?? 60;
  return (
    <Blueprint className="cert-logo" style={{ width: s, height: s }}>
      {cert.logo ? (
        <div className="img" style={{ backgroundImage: `url(${cert.logo})`, width: s - 12, height: s - 12 }} />
      ) : (
        <span className="code">{CERTS[cert.id].code}</span>
      )}
    </Blueprint>
  );
}

export function CertBadge({ cert, meta }: { cert: CertDTO; meta?: string }) {
  return (
    <div className="row" style={{ gap: 12, flexWrap: "nowrap", minWidth: 0 }}>
      <CertLogo cert={cert} />
      <div className="stack" style={{ minWidth: 0 }}>
        <span style={{ fontWeight: 500, fontSize: 14, lineHeight: 1.3 }}>{CERTS[cert.id].name}</span>
        <span className="xs muted">{meta ?? "Válido hasta " + expTxt(cert.exp)}</span>
      </div>
    </div>
  );
}

export function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="toast" role="status">
      {msg}
    </div>
  );
}

/** Selector de 1 a 5 estrellas (radiogroup accesible con teclado). */
export function StarInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="row"
      style={{ gap: 0, flexWrap: "nowrap" }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(5, (value || 0) + 1));
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(1, (value || 1) - 1));
      }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} de 5`}
          tabIndex={value ? (value === n ? 0 : -1) : n === 1 ? 0 : -1}
          className="star-btn"
          data-on={n <= value}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/** Resumen de una partida y, si la tiene, su descripción técnica completa (plegada). */
export function ItemText({ d, long, style }: { d: string; long?: string; style?: CSSProperties }) {
  return (
    <div style={{ minWidth: 0, ...style }}>
      <div>{d}</div>
      {long && (
        <details className="item-long">
          <summary>Descripción completa</summary>
          <div>{long}</div>
        </details>
      )}
    </div>
  );
}
