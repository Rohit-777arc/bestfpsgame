import type { ReactNode } from "react";

/** Big pick-one tiles used for maps and difficulty. */
export function Picker<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; title: string; sub?: string; swatch?: string; locked?: boolean }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <section>
      <h3 className="mso-display mb-2 text-xl text-primary">{label}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={o.locked}
            onClick={() => onChange(o.id)}
            className={`mso-card p-4 text-left ${value === o.id ? "mso-sel" : ""} disabled:opacity-50`}
          >
            {o.swatch && <div className="mb-3 h-16 rounded-lg border-[3px] border-[var(--mso-ink)]" style={{ background: o.swatch }} />}
            <div className="mso-display text-xl">{o.title}</div>
            {o.sub && <div className="text-sm text-muted-foreground">{o.sub}</div>}
          </button>
        ))}
      </div>
    </section>
  );
}

export function PageShell({ title, kicker, children }: { title: string; kicker?: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {kicker && <div className="mso-chip mb-3"><span className="mso-chip-label">{kicker}</span></div>}
      <h1 className="mso-banner mb-8 text-5xl sm:text-6xl">{title}</h1>
      <div className="flex flex-col gap-8">{children}</div>
    </main>
  );
}

export const MAP_SWATCH: Record<string, string> = {
  desert: "linear-gradient(160deg,#f2d7a6,#c9a36b 60%,#8a5a2b)",
  neon: "linear-gradient(160deg,#0b0d1a,#2a2f5e 50%,#ff3b6b)",
  frozen: "linear-gradient(160deg,#ffffff,#cfe0ee 50%,#7e99ab)",
};
