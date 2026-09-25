import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function DashboardPage({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dashboard-page" className={cn("min-h-svh bg-background text-foreground", className)} {...props} />;
}

function DashboardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dashboard-content" className={cn("mx-auto w-full max-w-[105rem] space-y-5 px-4 py-6 sm:px-6 lg:px-9", className)} {...props} />;
}

function PageHeading({ eyebrow, title, description, actions, className }: { eyebrow?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return <header data-slot="page-heading" className={cn("flex flex-wrap items-start justify-between gap-4", className)}><div className="min-w-0"><div className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{eyebrow}</div><h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>{description ? <p className="mt-1 text-sm font-medium text-muted-foreground">{description}</p> : null}</div>{actions ? <div className="flex items-center gap-2">{actions}</div> : null}</header>;
}

function SectionCard({ title, eyebrow, action, icon, className, contentClassName, children }: { title?: React.ReactNode; eyebrow?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode; className?: string; contentClassName?: string; children: React.ReactNode }) {
  return <Card data-slot="section-card" className={cn("gap-0 overflow-hidden py-0", className)}>{title || eyebrow || action || icon ? <CardHeader className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 border-b px-5 py-4"><div>{eyebrow ? <p className="text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground">{eyebrow}</p> : null}{title ? <CardTitle className="mt-1 text-base">{title}</CardTitle> : null}</div>{action ?? <span className="text-muted-foreground [&_svg]:size-5">{icon}</span>}</CardHeader> : null}<CardContent className={cn("px-0", contentClassName)}>{children}</CardContent></Card>;
}

function StatCard({ icon, label, value, trend, trendLabel, tone = "success", className }: { icon: React.ReactNode; label: React.ReactNode; value: React.ReactNode; trend?: React.ReactNode; trendLabel?: React.ReactNode; tone?: "success" | "warning" | "danger" | "neutral"; className?: string }) {
  const toneClass = { success: "bg-success/10 text-success", warning: "bg-warning/10 text-warning", danger: "bg-destructive/10 text-destructive", neutral: "bg-muted text-muted-foreground" }[tone];
  return <Card data-slot="stat-card" className={cn("relative min-h-32 gap-5 overflow-hidden p-4 py-4", className)}><div className="flex items-start justify-between gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><span>{label}</span><span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-[18px]">{icon}</span></div><strong className="text-3xl font-semibold tracking-tight text-foreground">{value}</strong>{trend ? <div className="flex items-center gap-2"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", toneClass)}>{trend}</span>{trendLabel ? <span className="truncate text-xs font-medium text-muted-foreground">{trendLabel}</span> : null}</div> : null}</Card>;
}

function StatusBadge({ tone = "neutral", dot = true, className, children, ...props }: React.ComponentProps<typeof Badge> & { tone?: "success" | "warning" | "danger" | "info" | "neutral"; dot?: boolean }) {
  const toneClass = { success: "border-success/15 bg-success/10 text-success", warning: "border-warning/15 bg-warning/10 text-warning", danger: "border-destructive/15 bg-destructive/10 text-destructive", info: "border-info/15 bg-info/10 text-info", neutral: "border-border bg-muted text-muted-foreground" }[tone];
  return <Badge variant="outline" className={cn("gap-1.5 rounded-full px-2.5 py-1 font-semibold", toneClass, className)} {...props}>{dot ? <span className="size-1.5 rounded-full bg-current" /> : null}{children}</Badge>;
}

function EmptyState({ icon, title, description, text, className }: { icon: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; text?: React.ReactNode; className?: string }) {
  return <div data-slot="empty-state" className={cn("flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center", className)}><span className="text-muted-foreground [&_svg]:size-9">{icon}</span><h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3><p className="mt-1 max-w-md text-sm font-medium text-muted-foreground">{description ?? text}</p></div>;
}

function DataRow({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="data-row" className={cn("border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-muted/50", className)} {...props} />;
}

export { DashboardContent, DashboardPage, DataRow, EmptyState, PageHeading, SectionCard, StatCard, StatusBadge };
