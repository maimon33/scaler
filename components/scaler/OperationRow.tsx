import {
  Activity,
  AlertTriangle,
  History,
  Pencil,
  Radio,
  RotateCcw,
  TimerReset,
  Undo2,
} from 'lucide-react';
import type { Operation } from '@/lib/types';

export function OperationRow({
  operation,
  onEdit,
  onRerun,
  onRevert,
}: {
  operation: Operation;
  onEdit: (operation: Operation) => void;
  onRerun: (operation: Operation) => void;
  onRevert: (operation: Operation) => void;
}) {
  const running = operation.status === 'Running';
  const critical = operation.critical === true;
  const progress = Math.min(
    100,
    (operation.elapsedSeconds / operation.timeoutSeconds) * 100,
  );
  const statusStyle =
    operation.status === 'Succeeded'
      ? 'bg-[#e4f3e9] text-[#28704e]'
      : operation.status === 'Running'
        ? 'bg-[#e6eff7] text-[#326c91]'
        : operation.status === 'Timed out'
          ? 'bg-[#fee8e7] text-[#a33f39]'
          : 'bg-[#eceeeb] text-[#69736d]';
  return (
    <article
      data-operation-id={operation.id}
      className={`grid gap-4 border-l-[3px] px-5 py-4 lg:grid-cols-[minmax(210px,1.2fr)_minmax(180px,.8fr)_minmax(170px,.7fr)_auto] lg:items-center ${critical ? 'border-l-[#c94b43] bg-[#fff9f8]' : 'border-l-transparent'}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold ${statusStyle}`}
          >
            {running ? <Activity className="size-3" /> : null}
            {operation.status}
          </span>
          {operation.reversible ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#cfe0d5] bg-[#f4faf6] px-2 py-1 text-[10px] font-bold text-[#3c6f55]">
              <Undo2 className="size-2.5" /> Reversible
            </span>
          ) : null}
          {critical ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#c94b43] px-2 py-1 text-[10px] font-bold text-white">
              <AlertTriangle className="size-2.5" /> Critical
            </span>
          ) : null}
          {operation.notificationStatus === 'Sent' ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#d8c9e8] bg-[#f8f2ff] px-2 py-1 text-[10px] font-bold text-[#654390]">
              <Radio className="size-2.5" /> Slack sent
            </span>
          ) : null}
          <span className="font-mono text-[10px] text-[#8a958e]">
            {operation.id}
          </span>
        </div>
        <div className="mt-2 truncate text-sm font-semibold text-[#26342d]">
          {operation.kind} · {operation.workload}
        </div>
        <div className="mt-0.5 text-[11px] text-[#7d8981]">
          {operation.namespace} · {operation.actor}
        </div>
        {critical && operation.criticalReasons?.length ? (
          <div className="mt-1.5 font-mono text-[9px] font-bold tracking-wide text-[#a33f39]">
            {operation.criticalReasons.join(' · ')}
          </div>
        ) : null}
      </div>
      <div>
        <div className="text-xs font-semibold text-[#59685f]">
          {operation.from} → {operation.to} replicas
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e6eae7]">
          <div
            className={`h-full rounded-full transition-[width] ${critical ? 'bg-[#cf5b53]' : 'bg-[#4b9270]'}`}
            style={{ width: `${running ? Math.max(5, progress) : 100}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-[#7c8981]">
          <span>
            {operation.status === 'Scheduled'
              ? 'Starts 23:30'
              : `${operation.elapsedSeconds}s elapsed`}
          </span>
          <span>{operation.timeoutSeconds}s limit</span>
        </div>
      </div>
      <div className="flex items-start gap-2 text-xs text-[#68766e]">
        <History className="mt-0.5 size-3.5 shrink-0" />
        <div>
          <div className="font-semibold text-[#4e5f55]">
            Retain {operation.retentionDays} days
          </div>
          <div className="mt-0.5 text-[10px] leading-4 text-[#849087]">
            Older events purge nightly
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
        {operation.editable ? (
          <button
            onClick={() => onEdit(operation)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#d5ddd6] bg-white px-2.5 py-1.5 text-xs font-semibold shadow-sm"
          >
            <Pencil className="size-3" /> Edit
          </button>
        ) : null}
        {operation.status === 'Succeeded' ||
        operation.status === 'Timed out' ? (
          <button
            onClick={() => onRerun(operation)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#d5ddd6] bg-white px-2.5 py-1.5 text-xs font-semibold shadow-sm"
          >
            <RotateCcw className="size-3" /> Re-run
          </button>
        ) : null}
        {operation.reversible && operation.status === 'Succeeded' ? (
          <button
            onClick={() => onRevert(operation)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#d8c8ad] bg-[#fffaf1] px-2.5 py-1.5 text-xs font-semibold text-[#81571f] shadow-sm"
          >
            <Undo2 className="size-3" /> Revert
          </button>
        ) : null}
        {running ? (
          <span className="inline-flex items-center gap-1.5 px-1 text-[10px] font-semibold text-[#6f7d75]">
            <TimerReset className="size-3" /> Timed
          </span>
        ) : null}
      </div>
    </article>
  );
}
