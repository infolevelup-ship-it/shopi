import Link from "next/link";
import type { ReactNode } from "react";
import { statusMeta, type StatusKind, type Tone } from "@/lib/ui/status";

/* ------------------------------------------------------------------ badge */

const TONE_CLASS: Record<Tone, string> = {
  neutral: "badge-neutral",
  info: "badge-info",
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  purple: "badge-purple",
};

// doc 11 §35: siempre texto + color, nunca color solo. El significado del
// estado va en el title para que esté a un hover de distancia sin ensuciar
// la pantalla (doc 11 §95).
export function StatusBadge({ kind, status }: { kind: StatusKind; status: string }) {
  const meta = statusMeta(kind, status);
  return (
    <span className={`badge ${TONE_CLASS[meta.tone]}`} title={meta.meaning ?? meta.label}>
      {meta.label}
    </span>
  );
}

export function Tone_({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge ${TONE_CLASS[tone]}`}>{children}</span>;
}

/* ---------------------------------------------------------- page header */

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-2 inline-block text-sm text-text-soft hover:text-text"
        >
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-text">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-text-soft">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- empty state */

// doc 11 §54: nunca una lista vacía a secas — siempre explicar y ofrecer el
// siguiente paso.
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card card-pad text-center">
      <p className="font-medium text-text">{title}</p>
      {description && <p className="mt-1 text-sm text-text-soft">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------- KPI tile */

export function StatTile({
  value,
  label,
  href,
  tone,
}: {
  value: ReactNode;
  label: string;
  href?: string;
  tone?: Tone;
}) {
  const toneText =
    tone === "danger"
      ? "text-danger"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-text";

  const body = (
    <>
      <p className={`text-2xl font-semibold ${toneText}`}>{value}</p>
      <p className="mt-1 text-xs text-text-soft">{label}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="card card-pad block transition hover:bg-surface-soft">
        {body}
      </Link>
    );
  }
  return <div className="card card-pad">{body}</div>;
}

/* ------------------------------------------------------------- callouts */

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
}) {
  const cls = {
    info: "border-info/30 bg-info-bg text-[#175cd3]",
    warning: "border-warning/30 bg-warning-bg text-[#b54708]",
    danger: "border-danger/30 bg-danger-bg text-[#b42318]",
    success: "border-success/30 bg-success-bg text-[#05834b]",
  }[tone];

  return (
    <div className={`rounded-xl border p-4 text-sm ${cls}`}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}

/* --------------------------------------------------------- data section */

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
