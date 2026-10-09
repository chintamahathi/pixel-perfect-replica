import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageHeader, Panel } from "@/components/shared/ui-bits";
import { useFreshMind } from "@/hooks/use-freshmind";
import { STORES } from "@/data/seed";
import type { Category, Settings } from "@/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — FreshMind AI" },
      { name: "description", content: "Configure demo thresholds, markdown limits, transfer rules, donation eligibility and forecast horizon." },
      { property: "og:title", content: "Settings — FreshMind AI" },
      { property: "og:description", content: "Demo configuration for the FreshMind AI rule engine." },
    ],
  }),
  component: SettingsPage,
});

const ALL_CATS: Category[] = ["Dairy", "Bakery", "Fruits", "Vegetables"];
type NumKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];
const NUMS: { k: NumKey; label: string; min: number; max: number; hint: string }[] = [
  { k: "highRiskThreshold", label: "High-risk threshold", min: 1, max: 100, hint: "Score at or above = red" },
  { k: "mediumRiskThreshold", label: "Medium-risk threshold", min: 0, max: 99, hint: "Score at or above = amber" },
  { k: "maxMarkdownPct", label: "Max markdown (%)", min: 0, max: 80, hint: "Markdown Agent upper limit" },
  { k: "minStockMultiplier", label: "Min stock multiplier", min: 0, max: 5, hint: "Scales product safety stock" },
  { k: "transferCostPerUnit", label: "Transfer cost / unit (₹)", min: 0, max: 100, hint: "Used for transfer cost" },
  { k: "maxTransferCapacity", label: "Max transfer capacity (u)", min: 0, max: 1000, hint: "Per transfer" },
  { k: "minShelfForTransfer", label: "Min shelf life for transfer (d)", min: 0, max: 10, hint: "At arrival" },
  { k: "minShelfForDonation", label: "Min shelf life for donation (d)", min: 0, max: 10, hint: "Food-safety rule" },
  { k: "forecastHorizon", label: "Forecast horizon (d)", min: 1, max: 14, hint: "Used for shortages" },
];

function SettingsPage() {
  const { settings, saveSettings, resetDemo } = useFreshMind();
  const [s, setS] = useState<Settings>(settings);
  useEffect(() => setS(settings), [settings]);
  const errors = NUMS.filter(({ k, min, max }) => !(s[k] >= min && s[k] <= max)).map((n) => `${n.label} must be ${n.min}–${n.max}`);
  if (s.mediumRiskThreshold >= s.highRiskThreshold) errors.push("Medium threshold must be below high threshold");
  if (s.categories.length === 0) errors.push("Select at least one category");
  STORES.forEach((st) => { if (!s.storeNames[st.id].trim()) errors.push(`Store ${st.id} name is required`); if (!(s.storeCapacity[st.id] > 0)) errors.push(`Store ${st.id} capacity must be positive`); });

  return (
    <div>
      <PageHeader title="Settings" desc="Demo configuration. Saving recalculates risk scores, shortages and new recommendations."
        actions={<>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline"><RotateCcw className="mr-1.5 h-4 w-4" />Reset demo</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reset the demo?</AlertDialogTitle><AlertDialogDescription>Restores inventory, recommendations, activity, simulations and settings to the initial synthetic state.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={resetDemo}>Reset</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
          <Button disabled={errors.length > 0} onClick={() => saveSettings(s)}><Save className="mr-1.5 h-4 w-4" />Save settings</Button>
        </>} />
      {errors.length > 0 && <div className="mb-4 rounded-lg border border-destructive/30 bg-risk-high-soft p-3 text-xs text-risk-high">{errors.join(" · ")}</div>}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Stores">
          <div className="space-y-3">
            {STORES.map((st) => (
              <div key={st.id} className="grid grid-cols-[60px_1fr_140px] items-center gap-2">
                <span className="text-sm font-medium">Store {st.id}</span>
                <Input aria-label={`Store ${st.id} name`} value={s.storeNames[st.id]} maxLength={40} onChange={(e) => setS({ ...s, storeNames: { ...s.storeNames, [st.id]: e.target.value } })} />
                <Input aria-label={`Store ${st.id} capacity`} type="number" value={s.storeCapacity[st.id]} onChange={(e) => setS({ ...s, storeCapacity: { ...s.storeCapacity, [st.id]: Number(e.target.value) } })} />
              </div>
            ))}
          </div>
          <div className="mt-5 text-sm font-medium">Product categories</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALL_CATS.map((c) => { const on = s.categories.includes(c); return (
              <button key={c} onClick={() => setS({ ...s, categories: on ? s.categories.filter((x) => x !== c) : [...s.categories, c] })} className={on ? "rounded-full border border-primary bg-primary-soft px-3 py-1 text-xs text-primary" : "rounded-full border px-3 py-1 text-xs text-muted-foreground"}>{c}</button>); })}
          </div>
          <div className="mt-5 flex items-center justify-between rounded-lg border p-3">
            <div><div className="text-sm font-medium">Donation eligibility</div><div className="text-xs text-muted-foreground">Allow Food Rescue Agent to propose donations</div></div>
            <Switch checked={s.donationEnabled} onCheckedChange={(v) => setS({ ...s, donationEnabled: v })} />
          </div>
        </Panel>
        <Panel title="Rules & thresholds">
          <div className="grid gap-3 sm:grid-cols-2">
            {NUMS.map(({ k, label, hint }) => (
              <label key={k} className="text-xs font-medium">{label}
                <Input type="number" className="mt-1" value={s[k]} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })} />
                <span className="mt-0.5 block font-normal text-muted-foreground">{hint}</span>
              </label>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
