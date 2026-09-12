'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlarmClock,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Cloud,
  Copy,
  History,
  FileCode2,
  Gauge,
  KeyRound,
  Layers3,
  Lightbulb,
  Lock,
  Pencil,
  MoreHorizontal,
  Plus,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DefinitionBox,
  FieldLabel,
  FlowArrow,
  FlowNode,
  ReviewRow,
} from '@/components/scaler/DefinitionForm';
import { FeatureSuggestion } from '@/components/scaler/FeatureSuggestion';
import { GuideStep } from '@/components/scaler/GuideStep';
import { Metric } from '@/components/scaler/Metric';
import { OperationRow } from '@/components/scaler/OperationRow';
import { Schedule } from '@/components/scaler/Schedule';
import { Owner, State } from '@/components/scaler/StatusBadges';
import { TriggerPicker } from '@/components/scaler/TriggerPicker';
import { TriggerRolePanel } from '@/components/scaler/TriggerRolePanel';
import { initialOperations, initialServices, nav } from '@/lib/demo-data';
import { defaultFieldValues, getTrigger } from '@/lib/triggers';
import type {
  Operation,
  Service,
  TriggerFieldValues,
  TriggerTypeId,
} from '@/lib/types';

function buildDefinitionYaml({
  name,
  namespace,
  targetName,
  minimum,
  maximum,
  headroomEnabled,
  headroomType,
  headroomValue,
  triggerType,
  triggerValues,
}: {
  name: string;
  namespace: string;
  targetName: string;
  minimum: number;
  maximum: number;
  headroomEnabled: boolean;
  headroomType: string;
  headroomValue: number;
  triggerType: TriggerTypeId;
  triggerValues: TriggerFieldValues;
}) {
  const trigger = getTrigger(triggerType);
  const lines = [
    'apiVersion: scaler.io/v1alpha1',
    'kind: Scaler',
    'metadata:',
    `  name: ${name || 'untitled-scaler'}`,
    `  namespace: ${namespace}`,
    'spec:',
    '  targetRef:',
    '    kind: Deployment',
    `    name: ${targetName}`,
    '  replicas:',
    `    min: ${minimum}`,
    `    max: ${maximum}`,
  ];
  if (headroomEnabled) {
    lines.push(
      '    headroom:',
      `      type: ${headroomType === 'Percent' ? 'percent' : 'replicas'}`,
      `      value: ${headroomValue}`,
    );
  }
  lines.push(
    '  source:',
    ...trigger.yamlLines(triggerValues).map((line) => `    ${line}`),
  );
  if (trigger.mode === 'poll') {
    lines.push(
      '  behavior:',
      '    pollEvery: 5s',
      '    onSourceFailure:',
      '      strategy: floor',
      '      replicas: 6',
    );
  }
  return lines.join('\n');
}

export default function Home() {
  const [services, setServices] = useState(initialServices);
  const [operations, setOperations] = useState(initialOperations);
  const [active, setActive] = useState('Overview');
  const [query, setQuery] = useState('');
  const [scaleTarget, setScaleTarget] = useState<Service | null>(null);
  const [replicas, setReplicas] = useState(1);
  const [toast, setToast] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [definitionOpen, setDefinitionOpen] = useState(false);
  const [definitionMode, setDefinitionMode] = useState('guided');
  const [definitionName, setDefinitionName] = useState('events-worker-sqs');
  const [definitionNamespace, setDefinitionNamespace] = useState('production');
  const [targetName, setTargetName] = useState('events-worker');
  const [triggerType, setTriggerType] = useState<TriggerTypeId>('aws-sqs');
  const [triggerValues, setTriggerValues] = useState<TriggerFieldValues>(() =>
    defaultFieldValues(getTrigger('aws-sqs')),
  );
  const [minimum, setMinimum] = useState(2);
  const [maximum, setMaximum] = useState(80);
  const [headroomEnabled, setHeadroomEnabled] = useState(true);
  const [headroomType, setHeadroomType] = useState('Percent');
  const [headroomValue, setHeadroomValue] = useState(20);
  const [yamlOverride, setYamlOverride] = useState<string | null>(null);
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

  const selectedTrigger = getTrigger(triggerType);
  const generatedYaml = useMemo(
    () =>
      buildDefinitionYaml({
        name: definitionName,
        namespace: definitionNamespace,
        targetName,
        minimum,
        maximum,
        headroomEnabled,
        headroomType,
        headroomValue,
        triggerType,
        triggerValues,
      }),
    [
      definitionName,
      definitionNamespace,
      targetName,
      minimum,
      maximum,
      headroomEnabled,
      headroomType,
      headroomValue,
      triggerType,
      triggerValues,
    ],
  );
  const yaml = yamlOverride ?? generatedYaml;

  function selectTrigger(id: TriggerTypeId) {
    setTriggerType(id);
    setTriggerValues(defaultFieldValues(getTrigger(id)));
    setYamlOverride(null);
  }
  function changeTriggerField(key: string, value: string | number) {
    setTriggerValues((current) => ({ ...current, [key]: value }));
    setYamlOverride(null);
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setOperations((items) =>
        items.map((operation) => {
          if (operation.status !== 'Running') return operation;
          const elapsedSeconds = operation.elapsedSeconds + 1;
          return elapsedSeconds >= operation.timeoutSeconds
            ? {
                ...operation,
                elapsedSeconds,
                status: 'Timed out',
                critical: true,
                criticalReasons: [
                  operation.to > operation.from
                    ? 'SCALE_UP_TIMED_OUT'
                    : 'SCALE_DOWN_TIMED_OUT',
                ],
                notificationStatus: 'Sent',
              }
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
      critical: false,
      criticalReasons: [],
      notificationStatus: 'None',
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
      critical: false,
      criticalReasons: [],
      notificationStatus: 'None',
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
        critical: false,
        criticalReasons: [],
        notificationStatus: 'None',
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
              const Icon = [
                Activity,
                FileCode2,
                Layers3,
                AlarmClock,
                Clock3,
                KeyRound,
              ][index];
              return (
                <button
                  key={item}
                  onClick={() => {
                    setActive(item);
                    if (item === 'Definitions') {
                      setDefinitionOpen(true);
                      return;
                    }
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
                onClick={() => setDefinitionOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-[#153e32] px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
              >
                <Plus className="size-4" /> Create scaler
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

      {definitionOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#10221b]/35 p-3 backdrop-blur-[2px] sm:p-6">
          <dialog
            open
            aria-modal="true"
            aria-labelledby="definition-title"
            className="mx-auto min-h-[calc(100vh-1.5rem)] max-w-[1280px] overflow-hidden rounded-2xl border border-[#cfd8d1] bg-[#f6f7f4] shadow-2xl sm:min-h-0"
          >
            <header className="flex flex-col gap-4 border-b border-[#d9dfda] bg-white px-5 py-5 sm:flex-row sm:items-center sm:px-7">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#153e32] text-[#c8f5d9]">
                  <Workflow className="size-5" />
                </span>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6f7c74]">
                    New scaler definition
                  </div>
                  <h2
                    id="definition-title"
                    className="mt-1 text-xl font-semibold tracking-[-0.03em]"
                  >
                    Describe when and how to scale
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <span className="mr-2 hidden items-center gap-1.5 text-xs text-[#647269] md:flex">
                  <span className="size-1.5 rounded-full bg-[#31a36c]" /> Draft
                  saved
                </span>
                <button
                  onClick={() => setDefinitionOpen(false)}
                  className="ml-auto grid size-9 place-items-center rounded-lg border border-[#d8ded9] bg-white"
                  aria-label="Close scaler definition"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>

            <Tabs
              value={definitionMode}
              onValueChange={(value) => setDefinitionMode(String(value))}
              className="gap-0"
            >
              <div className="border-b border-[#d9dfda] bg-white px-5 sm:px-7">
                <TabsList
                  variant="line"
                  aria-label="Definition authoring mode"
                  className="h-12 gap-5"
                >
                  <TabsTrigger
                    value="guided"
                    className="px-0 text-xs sm:text-sm"
                  >
                    <Settings2 className="size-3.5" /> Guided
                  </TabsTrigger>
                  <TabsTrigger value="flow" className="px-0 text-xs sm:text-sm">
                    <Workflow className="size-3.5" /> Flow / Composer
                  </TabsTrigger>
                  <TabsTrigger value="yaml" className="px-0 text-xs sm:text-sm">
                    <FileCode2 className="size-3.5" /> YAML
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="grid min-h-[620px] lg:grid-cols-[minmax(0,1fr)_310px]">
                <div className="min-w-0 p-5 sm:p-7">
                  <TabsContent value="guided">
                    <div className="mb-5">
                      <h3 className="text-lg font-semibold tracking-[-0.02em]">
                        Build with guided boxes
                      </h3>
                      <p className="mt-1 text-sm text-[#6f7c74]">
                        Complete each part of the policy. Advanced details stay
                        optional.
                      </p>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      <DefinitionBox
                        step="01"
                        title="Name & location"
                        description="Where this definition lives."
                        complete
                      >
                        <FieldLabel label="Definition name">
                          <input
                            value={definitionName}
                            onChange={(event) =>
                              setDefinitionName(event.target.value)
                            }
                            className="definition-input"
                          />
                        </FieldLabel>
                        <FieldLabel label="Namespace">
                          <select
                            className="definition-input"
                            value={definitionNamespace}
                            onChange={(event) =>
                              setDefinitionNamespace(event.target.value)
                            }
                          >
                            <option>production</option>
                            <option>jobs</option>
                          </select>
                        </FieldLabel>
                      </DefinitionBox>
                      <DefinitionBox
                        step="02"
                        title="Workload"
                        description="The Kubernetes target to control."
                        complete
                      >
                        <FieldLabel label="Kind">
                          <select
                            className="definition-input"
                            defaultValue="Deployment"
                          >
                            <option>Deployment</option>
                            <option>StatefulSet</option>
                          </select>
                        </FieldLabel>
                        <FieldLabel label="Target name">
                          <input
                            value={targetName}
                            onChange={(event) =>
                              setTargetName(event.target.value)
                            }
                            className="definition-input"
                          />
                        </FieldLabel>
                        <div className="col-span-full flex items-center gap-2 rounded-lg bg-[#eef6f0] px-3 py-2 text-[11px] text-[#35664d]">
                          <ShieldCheck className="size-3.5" /> No competing HPA
                          detected
                        </div>
                      </DefinitionBox>
                      <DefinitionBox
                        step="03"
                        title="Signal"
                        description="What should drive replica demand."
                        complete
                      >
                        <TriggerPicker
                          selected={triggerType}
                          onSelect={selectTrigger}
                          values={triggerValues}
                          onChangeField={changeTriggerField}
                        />
                      </DefinitionBox>
                      <DefinitionBox
                        step="04"
                        title="Limits & safety"
                        description="Bound the controller and choose failure behavior."
                        complete
                      >
                        <FieldLabel label="Minimum replicas">
                          <input
                            type="number"
                            value={minimum}
                            onChange={(event) =>
                              setMinimum(Number(event.target.value))
                            }
                            className="definition-input"
                          />
                        </FieldLabel>
                        <FieldLabel label="Maximum replicas">
                          <input
                            type="number"
                            value={maximum}
                            onChange={(event) =>
                              setMaximum(Number(event.target.value))
                            }
                            className="definition-input"
                          />
                        </FieldLabel>
                        <label className="sm:col-span-2 flex cursor-pointer items-start gap-3 rounded-lg border border-[#d9e1db] bg-[#f8faf8] p-3">
                          <Checkbox
                            checked={headroomEnabled}
                            onCheckedChange={(checked) =>
                              setHeadroomEnabled(checked === true)
                            }
                            aria-label="Add scaling headroom"
                            className="mt-0.5 border-[#8ca394] data-checked:border-[#2f7453] data-checked:bg-[#2f7453]"
                          />
                          <span>
                            <span className="block text-xs font-semibold text-[#3d5045]">
                              Add headroom
                            </span>
                            <span className="mt-0.5 block text-[10px] leading-4 text-[#748078]">
                              Keep spare capacity above calculated demand,
                              without exceeding the maximum.
                            </span>
                          </span>
                        </label>
                        {headroomEnabled ? (
                          <>
                            <FieldLabel label="Headroom type">
                              <select
                                className="definition-input"
                                value={headroomType}
                                onChange={(event) =>
                                  setHeadroomType(event.target.value)
                                }
                              >
                                <option>Percent</option>
                                <option>Fixed replicas</option>
                              </select>
                            </FieldLabel>
                            <FieldLabel
                              label={
                                headroomType === 'Percent'
                                  ? 'Extra capacity (%)'
                                  : 'Extra replicas'
                              }
                            >
                              <input
                                type="number"
                                min="1"
                                value={headroomValue}
                                onChange={(event) =>
                                  setHeadroomValue(
                                    Math.max(1, Number(event.target.value)),
                                  )
                                }
                                className="definition-input"
                              />
                            </FieldLabel>
                          </>
                        ) : null}
                        <FieldLabel label="If source fails" wide>
                          <select
                            className="definition-input"
                            defaultValue="Keep a safe floor of 6"
                          >
                            <option>Keep a safe floor of 6</option>
                            <option>Hold current replicas</option>
                          </select>
                        </FieldLabel>
                      </DefinitionBox>
                    </div>
                  </TabsContent>

                  <TabsContent value="flow">
                    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                      <div>
                        <h3 className="text-lg font-semibold tracking-[-0.02em]">
                          Policy composer
                        </h3>
                        <p className="mt-1 text-sm text-[#6f7c74]">
                          Read the decision from left to right. Select a block
                          to configure it.
                        </p>
                      </div>
                      <button
                        onClick={() => notify('Condition block added to draft')}
                        className="flex w-fit items-center gap-1.5 rounded-lg border border-[#d4dbd5] bg-white px-3 py-2 text-xs font-semibold"
                      >
                        <Plus className="size-3.5" /> Add condition
                      </button>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-[#d7ddd8] bg-[radial-gradient(#ccd5ce_1px,transparent_1px)] [background-size:18px_18px]">
                      <div className="flex min-h-[470px] min-w-[820px] items-center justify-center gap-3 p-8">
                        <FlowNode
                          icon={<selectedTrigger.icon />}
                          eyebrow="When"
                          title={selectedTrigger.label}
                          lines={selectedTrigger.flowLines(triggerValues)}
                          active
                        />
                        <FlowArrow label="observe" />
                        <FlowNode
                          icon={<Gauge />}
                          eyebrow="Calculate"
                          title="Replica demand"
                          lines={[
                            headroomEnabled
                              ? `Add ${headroomValue}${headroomType === 'Percent' ? '%' : ' replicas'} headroom`
                              : 'No headroom',
                            `Clamp to ${minimum}–${maximum}`,
                          ]}
                        />
                        <FlowArrow label="bound" />
                        <FlowNode
                          icon={<Layers3 />}
                          eyebrow="Then"
                          title={`Scale ${targetName}`}
                          lines={[`${minimum} minimum`, `${maximum} maximum`]}
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#65736a]">
                      <span className="font-semibold text-[#3e5147]">
                        Safety branch:
                      </span>
                      {selectedTrigger.mode === 'poll' ? (
                        <span className="rounded-full border border-[#dfcfb6] bg-[#fff8ec] px-2.5 py-1 text-[#805b2c]">
                          Source unavailable → floor 6
                        </span>
                      ) : (
                        <span className="rounded-full border border-[#dfcfb6] bg-[#fff8ec] px-2.5 py-1 text-[#805b2c]">
                          {selectedTrigger.mode === 'push'
                            ? `No events for ${triggerValues.decaySeconds}s → back to ${minimum}`
                            : `Hold current replicas on error`}
                        </span>
                      )}
                      <span className="rounded-full border border-[#cfded4] bg-[#eff7f1] px-2.5 py-1 text-[#35664d]">
                        Ownership checked before write
                      </span>
                    </div>
                  </TabsContent>

                  <TabsContent value="yaml">
                    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                      <div>
                        <h3 className="text-lg font-semibold tracking-[-0.02em]">
                          YAML definition
                        </h3>
                        <p className="mt-1 text-sm text-[#6f7c74]">
                          Use the same declarative format in GitOps, CI, or this
                          editor. Generated live from the Guided tab until you
                          edit it directly.
                        </p>
                      </div>
                      <div className="flex w-fit gap-2">
                        {yamlOverride !== null ? (
                          <button
                            onClick={() => setYamlOverride(null)}
                            className="rounded-lg border border-[#d4dbd5] bg-white px-3 py-2 text-xs font-semibold"
                          >
                            Reset to guided
                          </button>
                        ) : null}
                        <button
                          onClick={() => {
                            void navigator.clipboard?.writeText(yaml);
                            notify('YAML copied to clipboard');
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-[#d4dbd5] bg-white px-3 py-2 text-xs font-semibold"
                        >
                          <Copy className="size-3.5" /> Copy YAML
                        </button>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-[#243a31] bg-[#14221c] shadow-sm">
                      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-[10px] font-semibold text-[#adc0b5]">
                        <span className="font-mono">scaler.yaml</span>
                        <span className="flex items-center gap-1.5 text-[#8ed3aa]">
                          <Check className="size-3" />
                          {yamlOverride !== null
                            ? 'Edited'
                            : 'Valid · synced with Guided'}
                        </span>
                      </div>
                      <textarea
                        aria-label="Scaler YAML definition"
                        spellCheck={false}
                        value={yaml}
                        onChange={(event) =>
                          setYamlOverride(event.target.value)
                        }
                        className="min-h-[480px] w-full resize-none bg-transparent p-4 font-mono text-[12px] leading-6 text-[#d9e8df] outline-none"
                      />
                    </div>
                  </TabsContent>
                </div>

                <aside className="border-t border-[#d9dfda] bg-white p-5 lg:border-l lg:border-t-0 lg:p-6">
                  <div className="sticky top-5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">
                      Review
                    </div>
                    <h3 className="mt-2 text-base font-semibold">
                      {definitionName || 'Untitled scaler'}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-[#748078]">
                      A Scaler-owned policy for one Kubernetes workload.
                    </p>
                    <dl className="mt-5 divide-y divide-[#e5e9e5] rounded-xl border border-[#dce2dd] bg-[#fafbf9] px-4">
                      <ReviewRow
                        label="Target"
                        value={`Deployment / ${targetName}`}
                      />
                      <ReviewRow label="Source" value={selectedTrigger.label} />
                      <ReviewRow
                        label="Range"
                        value={`${minimum}–${maximum} replicas`}
                      />
                      <ReviewRow
                        label="Headroom"
                        value={
                          headroomEnabled
                            ? headroomType === 'Percent'
                              ? `${headroomValue}% above demand`
                              : `${headroomValue} extra replicas`
                            : 'None'
                        }
                      />
                      <ReviewRow
                        label="Failure"
                        value={
                          selectedTrigger.mode === 'poll'
                            ? 'Floor at 6'
                            : 'Not applicable'
                        }
                      />
                    </dl>
                    <div className="mt-4 rounded-xl border border-[#cfe0d5] bg-[#edf7f0] p-3.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#315e48]">
                        <ShieldCheck className="size-4" /> Ready to create
                      </div>
                      <p className="mt-1.5 text-[11px] leading-5 text-[#547362]">
                        Schema is valid and no conflicting owner was found.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setDefinitionOpen(false);
                        notify(`Scaler created · ${definitionName}`);
                      }}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#153e32] px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
                    >
                      Create scaler <ArrowRight className="size-4" />
                    </button>
                    <button
                      onClick={() => setDefinitionOpen(false)}
                      className="mt-2 w-full rounded-lg px-4 py-2 text-xs font-semibold text-[#65736a]"
                    >
                      Save as draft
                    </button>
                  </div>
                </aside>
              </div>
            </Tabs>
          </dialog>
        </div>
      )}

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
          <aside className="h-full w-full max-w-2xl overflow-y-auto bg-[#fbfcfa] p-6 shadow-2xl">
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
            <div className="mt-6">
              <TriggerRolePanel onAction={notify} />
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
