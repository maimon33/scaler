import { Pause, Play } from 'lucide-react';

export function Schedule({
  time,
  title,
  meta,
  active,
}: {
  time: string;
  title: string;
  meta: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#dfe4e0] bg-[#fafbf9] p-3">
      <div className="font-mono text-sm font-bold text-[#315e49]">{time}</div>
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold">{title}</div>
        <div className="mt-0.5 truncate text-[10px] text-[#7c8981]">{meta}</div>
      </div>
      <span
        className={`ml-auto grid size-6 place-items-center rounded-full ${active ? 'bg-[#e0f0e6] text-[#307354]' : 'bg-[#eceeec] text-[#7d8781]'}`}
      >
        {active ? (
          <Play className="size-2.5" fill="currentColor" />
        ) : (
          <Pause className="size-2.5" fill="currentColor" />
        )}
      </span>
    </div>
  );
}
