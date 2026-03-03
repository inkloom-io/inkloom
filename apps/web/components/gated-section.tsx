/**
 * Core-mode gated section stub.
 *
 * In core mode, all sections are available — no feature gating.
 * Children always render. Extra props are accepted but ignored.
 */
export function GatedSection({
  children,
}: {
  children: React.ReactNode;
  [key: string]: unknown;
}) {
  return <>{children}</>;
}
