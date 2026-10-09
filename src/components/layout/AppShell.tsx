import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Activity, BarChart3, Bell, BrainCircuit, CalendarDays, HeartHandshake, LayoutDashboard, Leaf, Menu, Network,
  Package, Search, Settings, Zap,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFreshMind } from "@/hooks/use-freshmind";
import { NETWORK_NAME, PRODUCTS, SIM_TODAY } from "@/data/seed";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";

export const NAV = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/inventory", label: "Inventory & Freshness", icon: Package },
  { to: "/decision-room", label: "AI Decision Room", icon: BrainCircuit },
  { to: "/network", label: "Store Network", icon: Network },
  { to: "/food-rescue", label: "Food Rescue", icon: HeartHandshake },
  { to: "/crisis-arena", label: "CrisisArena", icon: Zap },
  { to: "/analytics", label: "Analytics & Impact", icon: BarChart3 },
  { to: "/activity", label: "Activity & Approvals", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function SidebarBody({ onNav }: { onNav?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { recs } = useFreshMind();
  const pending = recs.filter((r) => r.status === "pending" || r.status === "edited").length;
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Leaf className="h-5 w-5" /></span>
        <div>
          <div className="font-display text-[15px] font-semibold text-sidebar-accent-foreground">FreshMind AI</div>
          <div className="text-[10px] uppercase tracking-widest opacity-60">Zero-waste OS</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((n) => {
          const active = path.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} onClick={onNav}
              className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground")}>
              <n.icon className={cn("h-4 w-4", active && "text-sidebar-primary")} />
              <span className="flex-1">{n.label}</span>
              {n.to === "/decision-room" && pending > 0 && (
                <span className="num rounded-full bg-sidebar-primary px-1.5 text-[10px] font-semibold text-sidebar-primary-foreground">{pending}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-xl border border-sidebar-border p-3">
        <div className="flex items-center gap-2 text-xs font-medium text-sidebar-accent-foreground">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sidebar-primary opacity-60" /><span className="relative h-2 w-2 rounded-full bg-sidebar-primary" /></span>
          Demo mode
        </div>
        <div className="mt-1 text-[11px] opacity-70">{NETWORK_NAME}</div>
        <div className="text-[11px] opacity-50">Synthetic data · agents simulated</div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const path = useRouterState({ select: (s) => s.location.pathname });
  const current = NAV.find((n) => path.startsWith(n.to));
  const { activity, unread, markRead } = useFreshMind();
  const navigate = useNavigate();
  const matches = q ? PRODUCTS.filter((p) => (p.name + p.sku).toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block"><SidebarBody /></aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0"><SheetTitle className="sr-only">Navigation</SheetTitle><SidebarBody onNav={() => setOpen(false)} /></SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6">
          <button className="rounded-md p-2 hover:bg-muted lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground">FreshMind / {current?.label ?? "Home"}</div>
            <div className="truncate font-display text-sm font-semibold">{current?.label}</div>
          </div>
          <div className="relative ml-auto hidden w-72 md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products or SKU…"
              className="h-9 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
            {matches.length > 0 && (
              <div className="surface absolute left-0 right-0 top-11 z-40 p-1">
                {matches.map((p) => (
                  <button key={p.id} className="flex w-full justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => { setQ(""); navigate({ to: "/inventory", search: { q: p.name } }); }}>
                    <span>{p.name}</span><span className="num text-xs text-muted-foreground">{p.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="hidden items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs text-muted-foreground xl:flex">
            <CalendarDays className="h-3.5 w-3.5" /> Sim date: {SIM_TODAY.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </div>
          <span className="hidden rounded-full bg-risk-med-soft px-2.5 py-1 text-[11px] font-semibold text-risk-med sm:inline">DEMO</span>
          <Popover onOpenChange={(o) => o && markRead()}>
            <PopoverTrigger className="relative rounded-lg p-2 hover:bg-muted" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="num absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{unread}</span>}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="border-b px-4 py-3 text-sm font-semibold">Notifications</div>
              <div className="max-h-80 overflow-auto">
                {activity.slice(0, 6).map((a) => (
                  <div key={a.id} className="border-b px-4 py-2.5 text-xs last:border-0">
                    <div className="text-foreground">{a.summary}</div>
                    <div className="mt-0.5 text-muted-foreground">{a.actor}</div>
                  </div>
                ))}
              </div>
              <Link to="/activity" className="block px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-muted">View all activity</Link>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger className="grid h-9 w-9 place-items-center rounded-full bg-ink text-xs font-semibold text-ink-foreground" aria-label="Profile">MA</DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Maha · Network Planner</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>Settings</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/activity" })}>My approvals</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
