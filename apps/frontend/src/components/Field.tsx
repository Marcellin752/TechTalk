interface FieldProps {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
}

export function Field({
  label,
  type,
  placeholder,
  value,
  onChange,
}: FieldProps) {
  return (
    <div>
      <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-2 block">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
      />
    </div>
  );
}
