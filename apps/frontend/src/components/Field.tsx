import { useId } from "react";

interface FieldProps {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  /** Lets password managers and browsers fill the field: "email", "current-password", "new-password", "name". */
  autoComplete?: string;
}

export function Field({
  label,
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
}: FieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-2 block">
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
      />
    </div>
  );
}
