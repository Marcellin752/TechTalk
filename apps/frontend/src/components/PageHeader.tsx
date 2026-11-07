import type { ComponentType, ReactNode } from "react";

/** The title block every tool page starts with. */
export function PageHeader({ icon: Icon, title, subtitle }: { icon: ComponentType<any>; title: string; subtitle?: string }) {
  return (
    <div className="text-center mb-8">
      <span className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto"><Icon size={24} /></span>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-3">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">{subtitle}</p>}
    </div>
  );
}

export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className="flex-1 overflow-y-auto"><div className={`${wide ? "max-w-4xl" : "max-w-3xl"} mx-auto px-4 sm:px-6 py-8 pb-16`}>{children}</div></div>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h2>
      {children}
    </section>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: Array<{ id: T; label: string }> }) {
  return (
    <div role="tablist" className="flex gap-1 p-1 rounded-xl bg-secondary w-fit mx-auto mb-6">
      {items.map((i) => (
        <button key={i.id} role="tab" aria-selected={value === i.id} onClick={() => onChange(i.id)} className={`px-4 h-8 rounded-lg text-[13px] font-semibold transition-colors ${value === i.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{i.label}</button>
      ))}
    </div>
  );
}

export const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70";
export const btnCls = "inline-flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50";
export const ghostCls = "inline-flex items-center justify-center gap-2 px-3 h-9 rounded-xl border border-border text-[13px] font-medium text-foreground hover:bg-secondary disabled:opacity-50";
