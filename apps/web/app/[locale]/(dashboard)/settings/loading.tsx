export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-10">
        <div
          className="mb-2 h-9 w-32 animate-pulse rounded-lg bg-[var(--surface-active)]"
        />
        <div
          className="h-5 w-64 animate-pulse rounded-lg bg-[var(--surface-hover)]"
        />
      </div>
      <div className="space-y-6">
        {[1, 2, 3].map((i: any) => (
          <div
            key={i}
            className="rounded-2xl p-6 bg-[var(--surface-bg)]"
            style={{
              border: "1px solid var(--glass-border)",
            }}
          >
            <div
              className="mb-4 h-5 w-24 animate-pulse rounded bg-[var(--surface-active)]"
            />
            <div
              className="h-14 w-full animate-pulse rounded-xl bg-[var(--surface-hover)]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
