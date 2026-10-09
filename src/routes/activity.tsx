import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, PageHeader, Panel, StatusBadge } from "@/components/shared/ui-bits";
import { useFreshMind } from "@/hooks/use-freshmind";
import { PRODUCTS, STORES } from "@/data/seed";
import { ACTION_LABEL, product } from "@/services/logic";
import { cn } from "@/lib/utils";
import type { ActionType, RecStatus } from "@/types";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity & Approvals — FreshMind AI" },
      { name: "description", content: "Audit trail of recommendations, approvals, edits, rejections and simulation runs." },
      { property: "og:title", content: "Activity & Approvals — FreshMind AI" },
      { property: "og:description", content: "Audit-friendly decision log for the zero-waste network." },
    ],
  }),
  component: ActivityPage,
});

const KIND_LABEL: Record<string, string> = { approval: "Approved", rejection: "Rejected", edit: "Edited", simulation: "Simulation", coordinator: "Coordinator", settings: "Settings", created: "Created" };

function ActivityPage() {
  const { activity, recs } = useFreshMind();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [store, setStore] = useState("all");
  const [prod, setProd] = useState("all");
  const [action, setAction] = useState("all");
  const [date, setDate] = useState("all");

  const counts = (s: RecStatus) => recs.filter((r) => r.status === s).length;
  const rows = useMemo(() => activity.filter((a) =>
    (kind === "all" || a.kind === kind) && (store === "all" || a.storeId === store) && (prod === "all" || a.productId === prod) &&
    (action === "all" || a.action === action) && (!q || (a.summary + a.actor).toLowerCase().includes(q.toLowerCase())) &&
    (date === "all" || (date === "session" ? new Date(a.timestamp) > new Date("2026-10-09T09:00:00") || new Date(a.timestamp).getFullYear() !== 2026 || true : true) && (date !== "session" || a.actor !== "Coordinator (simulated)" || a.kind === "created")),
  ), [activity, kind, store, prod, action, q, date]);

  return (
    <div>
      <PageHeader title="Activity & approvals" desc="Every simulated decision and planner action, persisted for this browser session." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[["Pending", counts("pending"), "pending"], ["Approved", counts("approved"), "approval"], ["Rejected", counts("rejected"), "rejection"], ["Edited", counts("edited"), "edit"], ["Simulation runs", activity.filter((a) => a.kind === "simulation").length, "simulation"], ["Coordinator decisions", activity.filter((a) => a.kind === "coordinator" || a.kind === "created").length, "coordinator"]].map(([l, v, k]) => (
          <button key={l as string} onClick={() => setKind(k === "pending" ? "coordinator" : (k as string))} className={cn("surface p-4 text-left transition-shadow hover:shadow-md", kind === k && "ring-2 ring-primary")}>
            <div className="text-xs text-muted-foreground">{l}</div><div className="num mt-1 text-2xl font-semibold">{v}</div>
          </button>
        ))}
      </div>

      <Panel className="mt-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-52 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search activity" className="h-9 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" /></div>
          <F v={kind} on={setKind} all="All types" opts={Object.entries(KIND_LABEL)} />
          <F v={store} on={setStore} all="All stores" opts={STORES.map((s) => [s.id, `Store ${s.id}`])} />
          <F v={prod} on={setProd} all="All products" opts={PRODUCTS.map((p) => [p.id, p.name])} />
          <F v={action} on={setAction} all="All actions" opts={(Object.keys(ACTION_LABEL) as ActionType[]).map((a) => [a, ACTION_LABEL[a]])} />
          <F v={date} on={setDate} all="Any date" opts={[["session", "This session only"]]} />
        </div>
        <div className="mt-4 overflow-x-auto">
          {rows.length === 0 ? <Empty title="No activity matches" /> : (
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="py-2 font-medium">Timestamp</th><th className="font-medium">Type</th><th className="font-medium">Summary</th><th className="font-medium">Previous</th><th className="font-medium">Updated</th><th className="font-medium">Actor</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className={cn("border-b", a.recId && "cursor-pointer hover:bg-muted/50")} onClick={() => a.recId && navigate({ to: "/decision-room", search: { rec: a.recId } })}>
                    <td className="num py-2.5 text-xs text-muted-foreground">{new Date(a.timestamp).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td><span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{KIND_LABEL[a.kind]}</span></td>
                    <td><div>{a.summary}</div>{a.productId && <div className="text-[11px] text-muted-foreground">{product(a.productId).sku} · Store {a.storeId}</div>}</td>
                    <td className="text-xs text-muted-foreground">{a.previous}</td>
                    <td className="text-xs">{["pending", "approved", "rejected", "edited"].includes(a.updated) ? <StatusBadge status={a.updated as RecStatus} /> : a.updated}</td>
                    <td className="text-xs">{a.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}

function F({ v, on, all, opts }: { v: string; on: (s: string) => void; all: string; opts: string[][] }) {
  return <Select value={v} onValueChange={on}><SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{all}</SelectItem>{opts.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>;
}
