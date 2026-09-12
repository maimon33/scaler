import type { ReactNode } from 'react';

export function Metric({
  label,
  value,
  detail,
  icon,
  amber,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  amber?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#d9dfda] bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#718078]">{label}</span>
        <span
          className={`grid size-7 place-items-center rounded-lg ${amber ? 'bg-[#f8eddc] text-[#ad6a1e]' : 'bg-[#e4efe8] text-[#347454]'} [&>svg]:size-3.5`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[#7b877f]">{detail}</div>
    </div>
  );
}
