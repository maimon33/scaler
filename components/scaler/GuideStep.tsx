'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function GuideStep({
  n,
  title,
  copy,
  code,
}: {
  n: string;
  title: string;
  copy: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-[#dbe1dc] bg-white p-4">
      <div className="flex gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#183f34] text-xs font-bold text-white">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-[#718078]">{copy}</p>
          <div className="relative mt-3 whitespace-pre-wrap rounded-lg bg-[#17231e] p-3 pr-10 font-mono text-[10px] leading-5 text-[#d8e8df]">
            {code}
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(code);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              }}
              className="absolute right-2 top-2 rounded p-1.5 text-[#a9bab0]"
              aria-label="Copy command"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
