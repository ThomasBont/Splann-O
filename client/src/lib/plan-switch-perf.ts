type PlanSwitchRecord = {
  startedAt: number;
  seq: number;
  marks: Set<string>;
};

type PlanSwitchPerfStore = {
  nextSeq: number;
  plans: Map<number, PlanSwitchRecord>;
};

declare global {
  interface Window {
    __splannoPlanSwitchPerf?: PlanSwitchPerfStore;
  }
}

function isEnabled() {
  return import.meta.env.DEV && typeof window !== "undefined";
}

function getStore(): PlanSwitchPerfStore | null {
  if (!isEnabled()) return null;
  if (!window.__splannoPlanSwitchPerf) {
    window.__splannoPlanSwitchPerf = {
      nextSeq: 1,
      plans: new Map<number, PlanSwitchRecord>(),
    };
  }
  return window.__splannoPlanSwitchPerf;
}

function getElapsedMs(record: PlanSwitchRecord) {
  return Math.round(performance.now() - record.startedAt);
}

export function startPlanSwitchPerf(planId: number, source = "route") {
  const store = getStore();
  if (!store || !Number.isFinite(planId) || planId <= 0) return;
  const seq = store.nextSeq++;
  store.plans.set(planId, {
    startedAt: performance.now(),
    seq,
    marks: new Set(),
  });
  console.log(`[plan-switch:${planId}#${seq}] start`, { source });
}

export function markPlanSwitchPerf(planId: number, label: string, details?: Record<string, unknown>) {
  const store = getStore();
  if (!store || !Number.isFinite(planId) || planId <= 0) return;
  const record = store.plans.get(planId);
  if (!record) return;
  if (record.marks.has(label)) return;
  record.marks.add(label);
  console.log(`[plan-switch:${planId}#${record.seq}] ${label} +${getElapsedMs(record)}ms`, details ?? {});
}

export function measurePlanSwitchPerf<T>(planId: number, label: string, run: () => T): T {
  const store = getStore();
  if (!store || !Number.isFinite(planId) || planId <= 0) return run();
  const record = store.plans.get(planId);
  if (!record) return run();
  const startedAt = performance.now();
  const result = run();
  const durationMs = Math.round(performance.now() - startedAt);
  console.log(`[plan-switch:${planId}#${record.seq}] ${label} computed in ${durationMs}ms`, {
    sinceSwitchMs: getElapsedMs(record),
  });
  return result;
}

