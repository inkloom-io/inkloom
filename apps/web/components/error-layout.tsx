"use client";

import Link from "next/link";
import { ArrowLeft, Home, RefreshCw } from "lucide-react";

/**
 * Shared layout for full-page error states (error boundaries, 404, etc.).
 *
 * Provides consistent visual design with mascot illustration, messaging,
 * and actionable CTAs. Used by both root and locale-level error/not-found pages.
 */

interface ErrorLayoutProps {
  /** Mascot image path (e.g. "/mascot-fixing.svg") */
  mascot: string;
  /** Optional small label above the heading (e.g. "404") */
  badge?: string;
  /** Main heading */
  title: string;
  /** Descriptive message below the heading */
  description: string;
  /** Optional error digest/ID to display for support reference */
  errorDigest?: string;
  /** Primary action button config */
  primaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: "refresh" | "home" | "back";
  };
  /** Secondary action button config */
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  /** Optional extra content below the buttons */
  children?: React.ReactNode;
}

const ACTION_ICONS = {
  refresh: RefreshCw,
  home: Home,
  back: ArrowLeft,
} as const;

export function ErrorLayout({
  mascot,
  badge,
  title,
  description,
  errorDigest,
  primaryAction,
  secondaryAction,
  children,
}: ErrorLayoutProps) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background px-4"
      style={{
        fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
      }}
    >
      <div
        className="flex max-w-md flex-col items-center text-center"
        style={{ animation: "errorPageIn 0.5s ease-out" }}
      >
        {/* Mascot illustration */}
        <img
          src={mascot}
          alt=""
          className="mb-8 h-44 w-44"
          style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.15))" }}
        />

        {/* Badge (e.g. "404" or "Error") */}
        {badge && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">
            {badge}
          </p>
        )}

        {/* Heading */}
        <h1
          className="mb-3 text-2xl font-bold text-foreground"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {title}
        </h1>

        {/* Description */}
        <p className="mb-2 max-w-sm text-sm leading-relaxed text-[var(--text-dim)]">
          {description}
        </p>

        {/* Error digest for support */}
        {errorDigest && (
          <p className="mb-6 font-mono text-xs text-[var(--text-dim)]/50">
            Reference: {errorDigest}
          </p>
        )}

        {!errorDigest && <div className="mb-6" />}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {primaryAction && (
            <PrimaryButton action={primaryAction} />
          )}
          {secondaryAction && (
            <SecondaryButton action={secondaryAction} />
          )}
        </div>

        {/* Extra content */}
        {children && <div className="mt-6">{children}</div>}
      </div>

      <style>{`
        @keyframes errorPageIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}

function PrimaryButton({
  action,
}: {
  action: NonNullable<ErrorLayoutProps["primaryAction"]>;
}) {
  const Icon = action.icon ? ACTION_ICONS[action.icon] : null;

  const className =
    "inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const style = {
    backgroundColor: "#14b8a6",
    boxShadow: "0 0 20px rgba(20,184,166,0.2)",
  };

  if (action.href) {
    return (
      <Link href={action.href} className={className} style={style}>
        {Icon && <Icon className="h-4 w-4" />}
        {action.label}
      </Link>
    );
  }

  return (
    <button onClick={action.onClick} className={className} style={style}>
      {Icon && <Icon className="h-4 w-4" />}
      {action.label}
    </button>
  );
}

function SecondaryButton({
  action,
}: {
  action: NonNullable<ErrorLayoutProps["secondaryAction"]>;
}) {
  const className =
    "inline-flex items-center gap-2 rounded-xl border border-[var(--glass-divider)] px-6 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-[rgba(255,255,255,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}
