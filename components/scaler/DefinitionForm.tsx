import type { ReactNode } from 'react';
import { ArrowRight, Check } from 'lucide-react';

export function DefinitionBox({
  step,
  title,
  description,
  complete,
  children,
}: {
  step: string;
  title: string;
  description: string;
  complete?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#d7ddd8] bg-white p-4 shadow-[0_1px_2px_rgba(20,40,30,.03)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#e4eee7] font-mono text-[10px] font-bold text-[#35634c]">
          {step}
        </span>
        <div>
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="mt-0.5 text-[11px] text-[#7a867e]">{description}</p>
        </div>
        {complete ? (
          <span className="ml-auto grid size-5 place-items-center rounded-full bg-[#dff1e5] text-[#2e7452]">
            <Check className="size-3" />
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function FieldLabel({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={`block text-[11px] font-semibold text-[#5b6961] ${wide ? 'sm:col-span-2' : ''}`}
    >
      {label}
      {children}
    </label>
  );
}

export function FlowNode({
  icon,
  eyebrow,
  title,
  lines,
  active,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  lines: string[];
  active?: boolean;
}) {
  return (
    <button
      className={`w-52 shrink-0 rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-[#5e9478] ring-2 ring-[#dcece2]' : 'border-[#d2dad4]'}`}
    >
      <span className="grid size-8 place-items-center rounded-lg bg-[#e4eee7] text-[#35634c] [&>svg]:size-4">
        {icon}
      </span>
      <span className="mt-4 block text-[9px] font-bold uppercase tracking-[0.12em] text-[#7b877f]">
        {eyebrow}
      </span>
      <strong className="mt-1 block truncate text-sm">{title}</strong>
      <span className="mt-3 block space-y-1 border-t border-[#e4e8e4] pt-3">
        {lines.map((line) => (
          <span key={line} className="block text-[11px] text-[#6d7a72]">
            {line}
          </span>
        ))}
      </span>
    </button>
  );
}

export function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1 text-[9px] font-semibold text-[#819087]">
      <span>{label}</span>
      <span className="flex w-full items-center">
        <span className="h-px flex-1 bg-[#9cac9f]" />
        <ArrowRight className="-ml-1 size-3.5" />
      </span>
    </div>
  );
}

export function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-[#89938d]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-xs font-semibold text-[#35453c]">
        {value}
      </dd>
    </div>
  );
}
