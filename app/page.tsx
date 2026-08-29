'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlarmClock,
  AlertTriangle,
  Check,
  ChevronDown,
  Clock3,
  Cloud,
  Copy,
  History,
  KeyRound,
  Layers3,
  Lightbulb,
  Lock,
  Pencil,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Undo2,
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
  owner: 'Scaler' | 'Native HPA' | 'Unmanaged';
  latency: string;
  state: 'Stable' | 'Scaling' | 'Paused';
};

type Operation = {
  id: string;
  workload: string;
  namespace: string;
  kind: 'Scale' | 'Schedule' | 'Revert';
  from: number;
  to: number;
  status: 'Running' | 'Succeeded' | 'Timed out' | 'Scheduled';
  elapsedSeconds: number;
  timeoutSeconds: number;
  actor: string;
  retentionDays: number;
  editable: boolean;
  reversible: boolean;
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
    owner: 'Native HPA',
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
    owner: 'Scaler',
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
    owner: 'Native HPA',
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
    owner: 'Scaler',
    latency: '—',
    state: 'Paused',
  },
];

const initialOperations: Operation[] = [
  {
    id: 'op-0142',
    workload: 'events-worker',
    namespace: 'production',
    kind: 'Scale',
    from: 18,
    to: 24,
    status: 'Running',
    elapsedSeconds: 7,
    timeoutSeconds: 30,
    actor: 'SQS policy',
    retentionDays: 30,
    editable: false,
    reversible: false,
  },
  {
    id: 'op-0141',
    workload: 'pdf-renderer',
    namespace: 'jobs',
    kind: 'Scale',
    from: 0,
    to: 8,
    status: 'Succeeded',
    elapsedSeconds: 3,
    timeoutSeconds: 10,
    actor: 'AM',
    retentionDays: 90,
    editable: false,
    reversible: true,
  },
  {
    id: 'op-0140',
    workload: 'events-worker',
    namespace: 'production',
    kind: 'Scale',
    from: 18,
    to: 36,
    status: 'Timed out',
    elapsedSeconds: 10,
    timeoutSeconds: 10,
    actor: 'Schedule',
    retentionDays: 14,
    editable: false,
    reversible: false,
  },
  {
    id: 'op-0139',
    workload: 'pdf-renderer',
    namespace: 'jobs',
    kind: 'Schedule',
    from: 8,
    to: 0,
    status: 'Scheduled',
    elapsedSeconds: 0,
    timeoutSeconds: 10,
    actor: 'Schedule · 23:30',
    retentionDays: 30,
    editable: true,
    reversible: false,
  },
];

const nav = ['Overview', 'Workloads', 'Schedules', 'Operations', 'Connections'];

export default function Home() {
  const [services, setServices] = useState(initialServices);
  const [operations, setOperations] = useState(initialOperations);
  const [active, setActive] = useState('Overview');
  const [query, setQuery] = useState('');
  const [scaleTarget, setScaleTarget] = useState<Service | null>(null);
  const [replicas, setReplicas] = useState(1);
  const [toast, setToast] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Operation | null>(null);
  const [editReplicas, setEditReplicas] = useState(0);
  const [editTimeout, setEditTimeout] = useState(10);
  const [editRetention, setEditRetention] = useState(30);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const visible = useMemo(
    () =>
      services.filter((s) =>
        `${s.name} ${s.namespace}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [services, query],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setOperations((items) =>
        items.map((operation) => {
          if (operation.status !== 'Running') return operation;
          const elapsedSeconds = operation.elapsedSeconds + 1;
          return elapsedSeconds >= operation.timeoutSeconds
            ? { ...operation, elapsedSeconds, status: 'Timed out' }
            : { ...operation, elapsedSeconds };
        }),
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  function openScale(service: Service) {
    setScaleTarget(service);
    setReplicas(service.desired);
  }
  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  }
  function rerunOperation(operation: Operation) {
    const next: Operation = {
      ...operation,
      id: `op-${Date.now()}`,
      status: 'Running',
      elapsedSeconds: 0,
      actor: 'Re-run · AM',
      editable: false,
      reversible: false,
    };
    setOperations((items) => [next, ...items]);
    notify(`Re-run started · ${operation.workload} → ${operation.to}`);
  }
  function revertOperation(operation: Operation) {
    const next: Operation = {
      ...operation,
      id: `op-${Date.now()}`,
      kind: 'Revert',
      from: operation.to,
      to: operation.from,
      status: 'Running',
      elapsedSeconds: 0,
      actor: `Revert ${operation.id} · AM`,
      editable: false,
      reversible: false,
    };
    setOperations((items) => [next, ...items]);
    setServices((items) =>
      items.map((service) =>
        service.name === operation.workload
          ? { ...service, desired: operation.from, state: 'Scaling' }
          : service,
      ),
    );
    notify(`Revert started · ${operation.workload} → ${operation.from}`);
  }
  function openOperationEditor(operation: Operation) {
    setEditTarget(operation);
    setEditReplicas(operation.to);
    setEditTimeout(operation.timeoutSeconds);
    setEditRetention(operation.retentionDays);
  }
  function saveOperationEdit() {
    if (!editTarget) return;
    setOperations((items) =>
      items.map((operation) =>
        operation.id === editTarget.id
          ? {
              ...operation,
              to: editReplicas,
              timeoutSeconds: editTimeout,
              retentionDays: editRetention,
            }
          : operation,
      ),
    );
    notify(`Schedule updated · ${editTarget.workload} → ${editReplicas}`);
    setEditTarget(null);
  }
  function applyScale() {
    if (!scaleTarget) return;
    if (scaleTarget.owner === 'Native HPA') {
      notify(`Transfer plan drafted · ${scaleTarget.name} was not changed`);
      setScaleTarget(null);
      return;
    }
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
    setOperations((items) => [
      {
        id: `op-${Date.now()}`,
        workload: scaleTarget.name,
        namespace: scaleTarget.namespace,
        kind: 'Scale',
        from: scaleTarget.current,
        to: replicas,
        status: 'Running',
        elapsedSeconds: 0,
        timeoutSeconds: 10,
        actor: 'Manual override · AM',
        retentionDays: 30,
        editable: false,
        reversible: false,
      },
      ...items,
    ]);
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
                  onClick={() => {
                    setActive(item);
                    if (item === 'Connections') {
                      setGuideOpen(true);
                      return;
                    }
                    const target =
                      item === 'Overview'
                        ? document.body
                        : document.getElementById(item.toLowerCase());
                    target?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active === item ? 'bg-[#e2e9e3] font-semibold text-[#153e32]' : 'text-[#607068] hover:bg-[#eaede9]'}`}
                >
                  <Icon className="size-4" />
                  {item}
                  {item === 'Operations' && (
                    <span className="ml-auto rounded-full bg-[#d9e0da] px-1.5 text-[10px]">
                      {operations.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto rounded-xl border border-[#d7ded8] bg-[#fbfcfa] p-3.5">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
              <ShieldCheck className="size-4 text-[#2d7a57]" /> Cluster API
            </div>
            <p className="text-[11px] leading-4 text-[#718078]">
              In-cluster service account. HPA access is read-only.
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
                Safe, focused control for native workloads and AWS SQS.
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
                onClick={() => openScale(services[1])}
                className="flex items-center gap-2 rounded-lg bg-[#153e32] px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
              >
                <Plus className="size-4" /> Scale workload
              </button>
            </div>
          </div>

          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-[#cfded4] bg-[#edf5ef] px-4 py-3.5 sm:flex-row sm:items-center">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#d8eadf] text-[#286449]">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#234b39]">
                Simple by design
              </div>
              <p className="mt-0.5 text-xs leading-5 text-[#597064]">
                Native Kubernetes first · AWS SQS is the only external source ·
                existing HPA ownership is protected.
              </p>
            </div>
            <span className="sm:ml-auto rounded-full border border-[#c4d9cb] bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#3d6d54]">
              Narrow scope
            </span>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Active replicas"
              value="38"
              detail="6 pending"
              icon={<Layers3 />}
            />
            <Metric
              label="Control sources"
              value="2"
              detail="Native Kubernetes + SQS"
              icon={<Radio />}
            />
            <Metric
              label="Median API accept"
              value="420ms"
              detail="Pod readiness tracked separately"
              icon={<Clock3 />}
            />
            <Metric
              label="Ownership guards"
              value="2"
              detail="HPA workloads are read-only"
              icon={<Lock />}
              amber
            />
          </div>

          <section
            id="operations"
            aria-labelledby="operations-heading"
            className="mb-6 overflow-hidden rounded-xl border border-[#d9dfda] bg-white shadow-[0_1px_2px_rgba(20,40,30,.03)]"
          >
            <div className="flex flex-col justify-between gap-3 border-b border-[#e0e4e0] px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="flex size-2">
                    <span className="absolute inline-flex size-2 animate-ping rounded-full bg-[#49a978] opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-[#2d8a5d]" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#4f7863]">
                    Live operations
                  </span>
                </div>
                <h2
                  id="operations-heading"
                  className="font-semibold tracking-[-0.02em]"
                >
                  Current and recent operations
                </h2>
                <p className="mt-0.5 text-xs text-[#748078]">
                  Timed attempts stay immutable; re-runs and reverts create new
                  audit records.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full bg-[#e5f4ea] px-2.5 py-1 font-semibold text-[#2d7150]">
                  {
                    operations.filter((item) => item.status === 'Running')
                      .length
                  }{' '}
                  running
                </span>
                <span className="rounded-full bg-[#f4eee4] px-2.5 py-1 font-semibold text-[#8b642e]">
                  {
                    operations.filter((item) => item.status === 'Timed out')
                      .length
                  }{' '}
                  timed out
                </span>
              </div>
            </div>
            <div className="divide-y divide-[#e7eae7]">
              {operations.map((operation) => (
                <OperationRow
                  key={operation.id}
                  operation={operation}
                  onEdit={openOperationEditor}
                  onRerun={rerunOperation}
                  onRevert={revertOperation}
                />
              ))}
            </div>
          </section>

          <div className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div
              id="workloads"
              className="overflow-hidden rounded-xl border border-[#d9dfda] bg-white shadow-[0_1px_2px_rgba(20,40,30,.03)]"
            >
              <div className="flex items-center justify-between border-b border-[#e0e4e0] px-5 py-4">
                <div>
                  <h2 className="font-semibold tracking-[-0.02em]">
                    Workloads
                  </h2>
                  <p className="mt-0.5 text-xs text-[#748078]">
                    Ownership is checked before every write
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
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="bg-[#f7f8f5] text-[10px] uppercase tracking-[0.08em] text-[#77837b]">
                    <tr>
                      <th className="px-5 py-2.5 font-semibold">Workload</th>
                      <th className="px-3 py-2.5 font-semibold">Replicas</th>
                      <th className="px-3 py-2.5 font-semibold">Signal</th>
                      <th className="px-3 py-2.5 font-semibold">Owner</th>
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
                          <Owner owner={service.owner} />
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
                            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold shadow-sm ${service.owner === 'Native HPA' ? 'border-[#e3d4bd] bg-[#fffaf1] text-[#8a5a20]' : 'border-[#d5ddd6] bg-white'}`}
                          >
                            {service.owner === 'Native HPA'
                              ? 'Inspect owner'
                              : 'Scale'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-5">
              {!suggestionDismissed ? (
                <div className="rounded-xl bg-[#163f33] p-5 text-white shadow-sm">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="grid size-9 place-items-center rounded-lg bg-white/10 text-[#a7f3d0]">
                      <Sparkles className="size-4" />
                    </div>
                    <span className="rounded-full bg-[#d8f9e5] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1d6547]">
                      Advisory
                    </span>
                  </div>
                  <h2 className="font-semibold">Add an SQS failure floor</h2>
                  <p className="mt-2 text-xs leading-5 text-[#bfd1c8]">
                    Queue metrics failed twice this week. Hold six workers after
                    three failed polls instead of relying on stale data.
                  </p>
                  <div className="my-4 rounded-lg border border-white/10 bg-black/10 p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#b5c9bf]">events-worker</span>
                      <span className="font-mono">floor 6</span>
                    </div>
                    <div className="mt-2 flex justify-between">
                      <span className="text-[#b5c9bf]">After</span>
                      <span>3 failed polls</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        notify('Policy draft created · no cluster change made')
                      }
                      className="flex-1 rounded-lg bg-[#d8f9e5] py-2 text-xs font-bold text-[#174b38]"
                    >
                      Review draft
                    </button>
                    <button
                      onClick={() => setSuggestionDismissed(true)}
                      className="rounded-lg border border-white/15 px-3 text-xs font-semibold"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#cfd8d1] bg-[#f8faf7] p-5">
                  <Lightbulb className="size-5 text-[#5d7968]" />
                  <h2 className="mt-3 text-sm font-semibold">
                    Suggestion dismissed
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[#748078]">
                    Recommendations remain advisory and never change cluster
                    state by themselves.
                  </p>
                  <button
                    onClick={() => setSuggestionDismissed(false)}
                    className="mt-3 text-xs font-semibold text-[#28694b]"
                  >
                    Restore suggestion
                  </button>
                </div>
              )}
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
                    onClick={() => {
                      setActive('Operations');
                      document
                        .getElementById('operations')
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="font-semibold text-[#266749]"
                  >
                    View operations
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div
            id="schedules"
            className="rounded-xl border border-[#d9dfda] bg-white p-5"
          >
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

          <div className="mt-6 rounded-xl border border-[#d9dfda] bg-white p-5">
            <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#718078]">
                  Suggested roadmap
                </div>
                <h2 className="font-semibold">
                  Small features with clear ownership
                </h2>
              </div>
              <p className="max-w-md text-xs leading-5 text-[#7a867e]">
                Each addition keeps the controller focused instead of growing a
                generic trigger platform.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <FeatureSuggestion
                stage="Now"
                title="Ownership guard"
                copy="Detect HPA or KEDA before writes and create a transfer plan instead of competing for replicas."
                icon={<Lock />}
              />
              <FeatureSuggestion
                stage="Next"
                title="SQS failure policy"
                copy="Choose hold-current or a safe replica floor when queue metrics become stale or unavailable."
                icon={<Radio />}
              />
              <FeatureSuggestion
                stage="Next"
                title="Readiness SLO"
                copy="Measure API acceptance, scheduling, and Ready pods separately so latency claims stay honest."
                icon={<Clock3 />}
              />
            </div>
          </div>
        </section>
      </div>

      {editTarget && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 grid place-items-center bg-[#10221b]/30 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setEditTarget(null)
          }
        >
          <dialog
            open
            aria-modal="true"
            aria-labelledby="edit-operation-title"
            className="w-full max-w-md rounded-2xl border border-[#d8dfd9] bg-[#fbfcfa] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#718078]">
                  Pending operation
                </div>
                <h2
                  id="edit-operation-title"
                  className="text-xl font-semibold tracking-[-0.03em]"
                >
                  Edit {editTarget.workload}
                </h2>
                <p className="mt-1 text-sm text-[#738078]">
                  Changes are allowed until this scheduled operation begins.
                </p>
              </div>
              <button
                aria-label="Close operation editor"
                onClick={() => setEditTarget(null)}
                className="rounded-lg p-1.5"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="my-6 space-y-4 rounded-xl border border-[#dbe1dc] bg-white p-4">
              <label className="block text-sm font-medium">
                Desired replicas
                <input
                  aria-label="Operation desired replicas"
                  type="number"
                  min="0"
                  value={editReplicas}
                  onChange={(event) =>
                    setEditReplicas(Math.max(0, Number(event.target.value)))
                  }
                  className="mt-2 h-10 w-full rounded-lg border border-[#cdd6cf] px-3"
                />
              </label>
              <label className="block text-sm font-medium">
                API timeout · seconds
                <input
                  aria-label="Operation timeout seconds"
                  type="number"
                  min="1"
                  max="300"
                  value={editTimeout}
                  onChange={(event) =>
                    setEditTimeout(
                      Math.min(300, Math.max(1, Number(event.target.value))),
                    )
                  }
                  className="mt-2 h-10 w-full rounded-lg border border-[#cdd6cf] px-3"
                />
              </label>
              <label className="block text-sm font-medium">
                Event retention
                <select
                  aria-label="Event retention period"
                  value={editRetention}
                  onChange={(event) =>
                    setEditRetention(Number(event.target.value))
                  }
                  className="mt-2 h-10 w-full rounded-lg border border-[#cdd6cf] bg-white px-3"
                >
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">365 days</option>
                </select>
              </label>
            </div>
            <div className="mb-5 flex gap-3 rounded-lg bg-[#fff5e5] p-3 text-xs leading-5 text-[#755329]">
              <History className="mt-0.5 size-4 shrink-0" />
              <span>
                Events older than <strong>{editRetention} days</strong> are
                permanently purged by the nightly retention sweep.
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditTarget(null)}
                className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={saveOperationEdit}
                className="flex items-center gap-2 rounded-lg bg-[#153e32] px-4 py-2 text-sm font-semibold text-white"
              >
                <Pencil className="size-4" /> Save changes
              </button>
            </div>
          </dialog>
        </div>
      )}

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
                  {scaleTarget.owner === 'Native HPA'
                    ? 'Ownership guard'
                    : 'Manual override'}
                </div>
                <h2 className="text-xl font-semibold tracking-[-0.03em]">
                  {scaleTarget.owner === 'Native HPA'
                    ? `${scaleTarget.name} is protected`
                    : `Scale ${scaleTarget.name}`}
                </h2>
                <p className="mt-1 text-sm text-[#738078]">
                  {scaleTarget.owner === 'Native HPA'
                    ? 'Scaler will not compete with its existing controller.'
                    : 'Applies immediately and pauses automation for 15 minutes.'}
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
            {scaleTarget.owner === 'Native HPA' ? (
              <div className="my-6 rounded-xl border border-[#ead8ba] bg-[#fffaf0] p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#a76820]" />
                  <div>
                    <h3 className="text-sm font-semibold text-[#67451f]">
                      Native HPA owns the replica field
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-[#80623f]">
                      A direct scale would be temporary and could cause
                      controller flapping. Create a reviewable
                      ownership-transfer plan before making this workload
                      writable.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
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
            )}
            <div className="mb-5 flex gap-3 rounded-lg bg-[#eef3ef] p-3 text-xs leading-5 text-[#59685f]">
              <Clock3 className="mt-0.5 size-4 shrink-0" />
              <span>
                {scaleTarget.owner === 'Native HPA' ? (
                  <>
                    The plan records the current HPA configuration and makes{' '}
                    <strong>no cluster change</strong>.
                  </>
                ) : (
                  <>
                    The <strong>10 second</strong> timeout covers API
                    acceptance. Pod readiness is measured separately.
                  </>
                )}
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
                {scaleTarget.owner === 'Native HPA' ? (
                  <>
                    <Lock className="size-4" /> Draft transfer plan
                  </>
                ) : (
                  <>
                    <Zap className="size-4" /> Apply scale
                  </>
                )}
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
                  Use local kube-proxy only for development. In-cluster, Scaler
                  uses its service account and a focused SQS identity.
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
                title="Local development only"
                copy="Forward the API while developing. The production browser never talks to kube-proxy."
                code="kubectl proxy --port=8001"
              />
              <GuideStep
                n="2"
                title="Use in-cluster Kubernetes access"
                copy="The server uses its service-account token. HPA resources are discovered read-only."
                code="serviceAccountName: scaler"
              />
              <GuideStep
                n="3"
                title="Attach an SQS-only role"
                copy="Use IRSA or EKS Pod Identity with only the queue inspection actions Scaler needs."
                code={
                  'eksctl create iamserviceaccount \\\n  --name scaler --namespace scaler \\\n  --attach-role-arn arn:aws:iam::123456789012:role/scaler'
                }
              />
              <GuideStep
                n="4"
                title="Static keys for local testing"
                copy="If necessary, pass short-lived credentials locally. Never store them in the image or browser."
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
function OperationRow({
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
          ? 'bg-[#fff0df] text-[#9a5e1f]'
          : 'bg-[#eceeeb] text-[#69736d]';
  return (
    <article
      data-operation-id={operation.id}
      className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(210px,1.2fr)_minmax(180px,.8fr)_minmax(170px,.7fr)_auto] lg:items-center"
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
      </div>
      <div>
        <div className="text-xs font-semibold text-[#59685f]">
          {operation.from} → {operation.to} replicas
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e6eae7]">
          <div
            className={`h-full rounded-full transition-[width] ${operation.status === 'Timed out' ? 'bg-[#d79548]' : 'bg-[#4b9270]'}`}
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
function Owner({ owner }: { owner: Service['owner'] }) {
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
function FeatureSuggestion({
  stage,
  title,
  copy,
  icon,
}: {
  stage: string;
  title: string;
  copy: string;
  icon: React.ReactNode;
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
