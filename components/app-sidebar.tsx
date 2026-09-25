"use client";

/* eslint-disable @next/next/no-html-link-for-pages */

import type { ReactNode } from "react";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { BrandMark } from "@/components/app-branding";

export type AppSidebarItem = { label: string; icon: ReactNode; active?: boolean; href?: string; onClick?: () => void };

export function AppSidebar({ items, name, role, initials, collapsed, onToggle, onSignOut }: { items: AppSidebarItem[]; name: string; role: string; initials: string; collapsed: boolean; onToggle: () => void; onSignOut: () => void }) {
  const renderItem = (item: AppSidebarItem, mobile = false) => item.href ? <a key={`${mobile ? "mobile" : "desktop"}-${item.label}`} href={item.href} className={item.active ? "active" : ""} title={item.label}>{item.icon}<span>{item.label}</span></a> : <button type="button" key={`${mobile ? "mobile" : "desktop"}-${item.label}`} className={item.active ? "active" : ""} onClick={item.onClick} title={item.label}>{item.icon}<span>{item.label}</span></button>;
  return <><aside className="ops-rail app-sidebar">
    <a href="/" className="rail-brand"><BrandMark /><span><b>Terenski Kompas</b><small>Field operations</small></span></a>
    <nav aria-label="Main navigation">{items.map((item) => renderItem(item))}</nav>
    <div className="rail-bottom"><div className="rail-account"><a className="profile-avatar-button" href="/profile">{initials}</a><a className="rail-user" href="/profile"><b>{name}</b><small>{role}</small></a><button type="button" className="rail-logout" onClick={onSignOut} title="Log out"><LogOut /></button></div><button type="button" className="rail-collapse" onClick={onToggle} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}<span>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span></button></div>
  </aside><nav className="app-mobile-nav" aria-label="Mobile navigation">{items.map((item) => renderItem(item, true))}</nav></>;
}
