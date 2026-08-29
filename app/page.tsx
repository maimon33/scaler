'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlarmClock,
  Check,
  ChevronDown,
  Clock3,
  Cloud,
  Copy,
  KeyRound,
  Layers3,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

type Service = {
  name: string;
  namespace: string;
  current: number;
  desired: number;
  min: number;
  max: number;
  trigger: string;
  latency: string;
  state: 'Stable' | 'Scaling' | 'Paused';
};

const initialServices: Service[] = [
  {
    name: 'checkout-api',
    namespace: 'production',
    current: 12,
    desired: 12,
    min: 4,
    max: 40,
    trigger: 'CPU · 61%',
    latency: '1.8s',
    state: 'Stable',
  },
  {
    name: 'events-worker',
    namespace: 'production',
    current: 18,
    desired: 24,
    min: 2,
    max: 80,
    trigger: 'SQS · 8.2k',
    latency: '2.4s',
    state: 'Scaling',
  },
  {
    name: 'recommendations',
    namespace: 'production',
    current: 8,
    desired: 8,
    min: 3,
    max: 24,
    trigger: 'RPS · 1.4k',
    latency: '1.2s',
    state: 'Stable',
  },
  {
    name: 'pdf-renderer',
    namespace: 'jobs',
    current: 0,
    desired: 0,
    min: 0,
    max: 30,
    trigger: 'Schedule',
    latency: '—',
    state: 'Paused',
  },
];

const nav = ['Overview', 'Workloads', 'Schedules', 'Operations', 'Connections'];

export default function Home() {
  const [services, setServices] = useState(initialServices);
  const [active, setActive] = useState('Overview');
  const [query, setQuery] = useState('');
  const [scaleTarget, setScaleTarget] = useState<Service | null>(null);
  const [replicas, setReplicas] = useState(1);
  const [toast, setToast] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const visible = useMemo(
    () =>
      services.filter((s) =>
        `${s.name} ${s.namespace}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [services, query],
  );

  function openScale(service: Service) {
    setScaleTarget(service);
    setReplicas(service.desired);
  }
  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  }
  function applyScale() {
    if (!scaleTarget) return;
    setServices((items) =>
      items.map((item) =>
        item.name === scaleTarget.name
          ? {
              ...item,
              desired: replicas,
              state: replicas === item.current ? 'Stable' : 'Scaling',
            }
          : item,
      ),
    );
    notify(`Scale request sent · ${scaleTarget.name} → ${replicas} replicas`);
    setScaleTarget(null);
  }

  return (
    <main className="min-h-screen bg-[#f4f5f2] text-[#18211d]">
      <header className="sticky top-0 z-30 border-b border-[#dce1dc] bg-[#f8f9f6]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-5 px-4 md:px-7">
          <div className="flex min-w-[190px] items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-[#123c31] text-[#bbf7d0]">
              <Zap className="size-4" fill="currentColor" />
            </div>
            <span className="text-lg font-semibold tracking-[-0.04em]">
              Scaler
            </span>
            <span className="rounded-md bg-[#e1e6e1] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[#647168]">
              MOCK
            </span>
          </div>
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7b877f]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workloads, namespaces…"
              className="h-9 w-full rounded-lg border border-[#d8ddd8] bg-white pl-9 pr-12 text-sm outline-none transition focus:border-[#6e8f80] focus:ring-2 focus:ring-[#dbe9e1]"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[#d8ddd8] px-1.5 py-0.5 text-[10px] text-[#6f7a73]">
              ⌘ K
            </span>
          </div>
          <button className="ml-auto flex items-center gap-2 rounded-lg border border-[#d8ddd8] bg-white px-3 py-2 text-sm font-medium shadow-sm">
            <span className="size-2 rounded-full bg-[#28a66a]" /> eks-prod-01{' '}
            <ChevronDown className="size-3.5" />
          </button>
          <button
            onClick={() => setGuideOpen(true)}
            className="grid size-9 place-items-center rounded-lg border border-[#d8ddd8] bg-white text-[#536158]"
            aria-label="Open connection guide"
          >
            <KeyRound className="size-4" />
          </button>
          <div className="grid size-8 place-items-center rounded-full bg-[#d5e8dc] text-xs font-bold text-[#245941]">
            AM
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 md:grid-cols-[205px_minmax(0,1fr)]">
        <aside className="hidden min-h-[calc(100vh-64px)] border-r border-[#dce1dc] px-3 py-6 md:flex md:flex-col">
          <nav className="space-y-1">
            {nav.map((item, index) => {
              const Icon = [Activity, Layers3, AlarmClock, Clock3, KeyRound][
                index
              ];
              return (
                <button
                  key={item}
                  onClick={() => setActive(item)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active === item ? 'bg-[#e2e9e3] font-semibold text-[#153e32]' : 'text-[#607068] hover:bg-[#eaede9]'}`}
                >
                  <Icon className="size-4" />
                  {item}
                  {item === 'Operations' && (
                    <span className="ml-auto rounded-full bg-[#d9e0da] px-1.5 text-[10px]">
                      4
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto rounded-xl border border-[#d7ded8] bg-[#fbfcfa] p-3.5">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
              <ShieldCheck className="size-4 text-[#2d7a57]" /> kube-proxy
              access
            </div>
            <p className="text-[11px] leading-4 text-[#718078]">
              Local proxy connected. No public endpoint is exposed.
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-[#2d7a57]">
              <span className="size-1.5 rounded-full bg-[#28a66a]" /> Healthy ·
              24ms
            </div>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-7 md:px-8 lg:px-10">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#6b786f]">
                <Cloud className="size-3.5" /> production / us-east-1
              </div>
              <h1 className="text-[28px] font-semibold tracking-[-0.04em]">
                Scaling overview
              </h1>
              <p className="mt-1 text-sm text-[#6d7a72]">
                Live replica state and operations across your cluster.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setGuideOpen(true)}
                className="rounded-lg border border-[#d4dbd5] bg-white px-3.5 py-2 text-sm font-semibold shadow-sm"
              >
                Connect source
              </button>
              <button
                onClick={() => openScale(services[0])}
                className="flex items-center gap-2 rounded-lg bg-[#153e32] px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
              >
                <Plus className="size-4" /> Scale workload
              </button>
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Active replicas"
              value="38"
              detail="6 pending"
              icon={<Layers3 />}
            />
            <Metric
              label="Operations · 1h"
              value="142"
              detail="99.3% successful"
              icon={<Activity />}
            />
            <Metric
              label="Median scale time"
              value="1.9s"
              detail="↓ 0.4s from yesterday"
              icon={<Clock3 />}
            />
            <Metric
              label="Timeout budget"
              value="2 / 20"
              detail="10% consumed"
              icon={<AlarmClock />}
              amber
            />
          </div>

          <div className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="overflow-hidden rounded-xl border border-[#d9dfda] bg-white shadow-[0_1px_2px_rgba(20,40,30,.03)]">
              <div className="flex items-center justify-between border-b border-[#e0e4e0] px-5 py-4">
                <div>
                  <h2 className="font-semibold tracking-[-0.02em]">
                    Workloads
                  </h2>
                  <p className="mt-0.5 text-xs text-[#748078]">
                    Desired state reconciles every second
                  </p>
                </div>
                <button
                  aria-label="Workload table options"
                  className="rounded-md border border-[#d7ddd8] p-1.5 text-[#718078]"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-[#f7f8f5] text-[10px] uppercase tracking-[0.08em] text-[#77837b]">
                    <tr>
                      <th className="px-5 py-2.5 font-semibold">Workload</th>
                      <th className="px-3 py-2.5 font-semibold">Replicas</th>
                      <th className="px-3 py-2.5 font-semibold">Signal</th>
                      <th className="px-3 py-2.5 font-semibold">
                        Last operation
                      </th>
                      <th className="px-3 py-2.5 font-semibold">State</th>
                      <th className="px-5 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e7eae7]">
                    {visible.map((service) => (
                      <tr key={service.name} className="hover:bg-[#fafbf8]">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-[#26342d]">
                            {service.name}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-[#849087]">
                            {service.namespace}
                          </div>
                        </td>
                        <td
                          aria-label={`${service.name} replica status`}
                          className="px-3 py-3.5"
                        >
                          <div className="flex items-baseline gap-1">
                            <span className="font-semibold">
                              {service.current}
                            </span>
                            <span className="text-xs text-[#829087]">
                              / {service.desired}
                            </span>
                          </div>
                          <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-[#e4e9e5]">
                            <div
                              className="h-full rounded-full bg-[#3f8b65]"
                              style={{
                                width: `${Math.max(4, (service.current / service.max) * 100)}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-xs font-medium text-[#59685f]">
                          {service.trigger}
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="font-mono text-xs">
                            {service.latency}
                          </div>
                          <div className="text-[10px] text-[#89938d]">
                            18 sec ago
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <State state={service.state} />
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => openScale(service)}
                            className="rounded-md border border-[#d5ddd6] bg-white px-2.5 py-1.5 text-xs font-semibold shadow-sm"
                          >
                            Scale
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-xl bg-[#163f33] p-5 text-white shadow-sm">
                <div className="mb-4 flex items-start justify-between">
                  <div className="grid size-9 place-items-center rounded-lg bg-white/10 text-[#a7f3d0]">
                    <Sparkles className="size-4" />
                  </div>
                  <span className="rounded-full bg-[#d8f9e5] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1d6547]">
                    Suggestion
                  </span>
                </div>
                <h2 className="font-semibold">Prepare for the 09:00 peak</h2>
                <p className="mt-2 text-xs leading-5 text-[#bfd1c8]">
                  Checkout traffic rises 34% on weekdays. Pre-scale 8 minutes
                  earlier to avoid cold starts.
                </p>
                <div className="my-4 rounded-lg border border-white/10 bg-black/10 p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#b5c9bf]">checkout-api</span>
                    <span className="font-mono">12 → 20</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-[#b5c9bf]">Starts</span>
                    <span>Mon–Fri · 08:52</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => notify('Schedule suggestion applied')}
                    className="flex-1 rounded-lg bg-[#d8f9e5] py-2 text-xs font-bold text-[#174b38]"
                  >
                    Apply schedule
                  </button>
                  <button className="rounded-lg border border-white/15 px-3 text-xs font-semibold">
                    Dismiss
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-[#d9dfda] bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">Operation health</h2>
                    <p className="mt-0.5 text-xs text-[#7b877f]">
                      Rolling 60 minutes
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[#2d7957]">
                    99.3%
                  </span>
                </div>
                <div className="flex h-14 items-end gap-1">
                  {[
                    55, 70, 42, 75, 64, 83, 56, 72, 88, 68, 79, 54, 92, 76, 64,
                    81, 58, 74, 87, 67, 90, 79, 84, 72,
                  ].map((n, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-sm ${i === 13 || i === 18 ? 'bg-[#e19d4c]' : 'bg-[#72a88c]'}`}
                      style={{ height: `${n}%` }}
                    />
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[#e4e8e4] pt-3 text-xs">
                  <span className="text-[#7a867e]">2 timeouts · 0 errors</span>
                  <button
                    onClick={() => setActive('Operations')}
                    className="font-semibold text-[#266749]"
                  >
                    View operations
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#d9dfda] bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Today’s schedules</h2>
                <p className="mt-0.5 text-xs text-[#7a867e]">
                  All times in Asia/Jerusalem
                </p>
              </div>
              <button className="flex items-center gap-1.5 text-xs font-semibold text-[#28694b]">
                <Plus className="size-3.5" /> New schedule
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Schedule
                time="08:52"
                title="Morning checkout peak"
                meta="checkout-api · 12 → 20"
                active
              />
              <Schedule
                time="17:45"
                title="Evening batch window"
                meta="events-worker · 18 → 36"
                active
              />
              <Schedule
                time="23:30"
                title="Render queue cooldown"
                meta="pdf-renderer · 8 → 0"
              />
            </div>
          </div>
        </section>
      </div>

      {scaleTarget && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 grid place-items-center bg-[#10221b]/30 p-4 backdrop-blur-[2px]"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setScaleTarget(null)
          }
        >
          <dialog
            open
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-[#d8dfd9] bg-[#fbfcfa] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#718078]">
                  Manual override
                </div>
                <h2 className="text-xl font-semibold tracking-[-0.03em]">
                  Scale {scaleTarget.name}
                </h2>
                <p className="mt-1 text-sm text-[#738078]">
                  Applies immediately and pauses automation for 15 minutes.
                </p>
              </div>
              <button
                aria-label="Close scale dialog"
                onClick={() => setScaleTarget(null)}
                className="rounded-lg p-1.5"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="my-6 rounded-xl border border-[#dbe1dc] bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Desired replicas</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setReplicas(Math.max(scaleTarget.min, replicas - 1))
                    }
                    className="grid size-8 place-items-center rounded-lg border"
                  >
                    −
                  </button>
                  <input
                    aria-label="Desired replicas"
                    type="number"
                    min={scaleTarget.min}
                    max={scaleTarget.max}
                    value={replicas}
                    onChange={(e) =>
                      setReplicas(
                        Math.min(
                          scaleTarget.max,
                          Math.max(scaleTarget.min, Number(e.target.value)),
                        ),
                      )
                    }
                    className="h-10 w-16 rounded-lg border border-[#cdd6cf] text-center text-lg font-bold"
                  />
                  <button
                    onClick={() =>
                      setReplicas(Math.min(scaleTarget.max, replicas + 1))
                    }
                    className="grid size-8 place-items-center rounded-lg border"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="mt-4 flex justify-between text-xs text-[#7c8981]">
                <span>Min {scaleTarget.min}</span>
                <span>Current {scaleTarget.current}</span>
                <span>Max {scaleTarget.max}</span>
              </div>
            </div>
            <div className="mb-5 flex gap-3 rounded-lg bg-[#eef3ef] p-3 text-xs leading-5 text-[#59685f]">
              <Clock3 className="mt-0.5 size-4 shrink-0" />
              <span>
                Request timeout is <strong>10 seconds</strong>. Late
                reconciliations are recorded in Operations.
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setScaleTarget(null)}
                className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={applyScale}
                className="flex items-center gap-2 rounded-lg bg-[#153e32] px-4 py-2 text-sm font-semibold text-white"
              >
                <Zap className="size-4" /> Apply scale
              </button>
            </div>
          </dialog>
        </div>
      )}

      {guideOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex justify-end bg-[#10221b]/25 backdrop-blur-[2px]"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setGuideOpen(false)
          }
        >
          <aside className="h-full w-full max-w-lg overflow-y-auto bg-[#fbfcfa] p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#718078]">
                  Connection guide
                </div>
                <h2 className="text-2xl font-semibold tracking-[-0.04em]">
                  Connect AWS & Kubernetes
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#6f7d75]">
                  Start with local kube-proxy access, then choose how Scaler
                  assumes AWS permissions.
                </p>
              </div>
              <button
                onClick={() => setGuideOpen(false)}
                className="rounded-lg p-2"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-7 space-y-4">
              <GuideStep
                n="1"
                title="Start kube-proxy"
                copy="Forward the in-cluster API locally. No public ingress is required."
                code="kubectl proxy --port=8001"
              />
              <GuideStep
                n="2"
                title="Use the node role"
                copy="On EKS, Scaler can use the worker node instance profile. No static keys are stored."
                code="AWS_CREDENTIAL_MODE=node"
              />
              <GuideStep
                n="3"
                title="Attach an OIDC role (recommended)"
                copy="Create a least-privilege service account role and attach it to Scaler."
                code={
                  'eksctl create iamserviceaccount \\\n  --name scaler --namespace scaler \\\n  --attach-role-arn arn:aws:iam::123456789012:role/scaler'
                }
              />
              <GuideStep
                n="4"
                title="Add access keys"
                copy="For local development only, pass keys as environment variables or mounted secrets."
                code={'AWS_ACCESS_KEY_ID=…\nAWS_SECRET_ACCESS_KEY=…'}
              />
            </div>
            <div className="mt-6 rounded-xl border border-[#cfe0d5] bg-[#edf7f0] p-4 text-xs leading-5 text-[#315e48]">
              <strong>Least privilege:</strong> grant only the AWS actions used
              by your trigger sources. Scope Kubernetes RBAC to intended
              namespaces.
            </div>
          </aside>
        </div>
      )}
      {toast && (
        <output className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-[#193e33] px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <span className="grid size-5 place-items-center rounded-full bg-[#d8f9e5] text-[#245941]">
            <Check className="size-3" />
          </span>
          {toast}
        </output>
      )}
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
  amber,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
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
function State({ state }: { state: Service['state'] }) {
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
function Schedule({
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
function GuideStep({
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
