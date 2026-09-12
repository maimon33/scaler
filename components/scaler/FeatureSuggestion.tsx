import type { ReactNode } from 'react';

export function FeatureSuggestion({
  stage,
  title,
  copy,
  icon,
}: {
  stage: string;
  title: string;
  copy: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-lg border border-[#dfe4e0] bg-[#fafbf9] p-4">
      <div className="flex items-center justify-between">
        <span className="grid size-8 place-items-center rounded-lg bg-[#e4efe8] text-[#347454] [&>svg]:size-3.5">
          {icon}
        </span>
        <span className="rounded-full bg-[#e8ece8] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#67736c]">
          {stage}
        </span>
      </div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-[#748078]">{copy}</p>
    </article>
  );
}
