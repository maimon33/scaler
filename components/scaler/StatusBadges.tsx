import { Activity, Lock, Pause } from 'lucide-react';
import type { Service } from '@/lib/types';

export function State({ state }: { state: Service['state'] }) {
  const style =
    state === 'Stable'
      ? 'bg-[#e4f3e9] text-[#28704e]'
      : state === 'Scaling'
        ? 'bg-[#e6eff7] text-[#326c91]'
        : 'bg-[#eceeeb] text-[#69736d]';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold ${style}`}
    >
      {state === 'Scaling' ? (
        <Activity className="size-3" />
      ) : state === 'Paused' ? (
        <Pause className="size-2.5" fill="currentColor" />
      ) : (
        <span className="size-1.5 rounded-full bg-current" />
      )}
      {state}
    </span>
  );
}

export function Owner({ owner }: { owner: Service['owner'] }) {
  const protectedOwner = owner === 'Native HPA';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold ${
        protectedOwner
          ? 'bg-[#fff4df] text-[#8b5b22]'
          : owner === 'Scaler'
            ? 'bg-[#e4f3e9] text-[#28704e]'
            : 'bg-[#eceeeb] text-[#69736d]'
      }`}
    >
      {protectedOwner ? <Lock className="size-2.5" /> : null}
      {owner}
    </span>
  );
}
