import {
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Eye,
  FolderKanban,
  Home,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { NavKey } from "../types";
import { Brand } from "./Brand";

const navItems: Array<{
  key: NavKey;
  label: string;
  icon: typeof Home;
}> = [
  { key: "dashboard", label: "Hoje", icon: Home },
  { key: "validation", label: "Validação", icon: ClipboardCheck },
  { key: "prospecting", label: "Prospecção", icon: Search },
  { key: "leads", label: "Leads", icon: Users },
  { key: "previews", label: "Sites", icon: Eye },
  { key: "portfolio", label: "Portfólio", icon: FolderKanban },
  { key: "finance", label: "Financeiro", icon: CircleDollarSign },
  { key: "messages", label: "Mensagens", icon: MessageSquareText },
];

interface AppShellProps {
  active: NavKey;
  theme: "light" | "dark";
  profileName: string;
  profileEmail: string;
  profileRole: string;
  signingOut: boolean;
  isOwner: boolean;
  onNavigate: (key: NavKey) => void;
  onToggleTheme: () => void;
  onSignOut: () => void;
  children: ReactNode;
}

export function AppShell({
  active,
  theme,
  profileName,
  profileEmail,
  profileRole,
  signingOut,
  isOwner,
  onNavigate,
  onToggleTheme,
  onSignOut,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const visibleNavItems = isOwner
    ? navItems
    : navItems.filter(
        (item) =>
          item.key !== "finance" &&
          item.key !== "previews" &&
          item.key !== "portfolio",
      );
  const mobileNavItems = visibleNavItems.filter((item) =>
    isOwner
      ? ["dashboard", "validation", "prospecting", "leads", "previews"].includes(
          item.key,
        )
      : ["dashboard", "validation", "prospecting", "leads", "messages"].includes(
          item.key,
        ),
  );
  const profileInitials = profileName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const navigate = (key: NavKey) => {
    onNavigate(key);
    setMobileOpen(false);
    setProfileOpen(false);
  };

  const handleSignOut = () => {
    setProfileOpen(false);
    onSignOut();
  };

  return (
    <div className="app-shell refined-shell" data-active-view={active}>
      <aside className={`sidebar refined-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="sidebar-header">
          <Brand />
          <button
            className="icon-button sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="main-nav" aria-label="Navegação principal">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={`nav-item ${active === item.key ? "active" : ""}`}
                onClick={() => navigate(item.key)}
                aria-current={active === item.key ? "page" : undefined}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer refined-sidebar-footer">
          <button className="theme-sidebar-control" onClick={onToggleTheme}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === "dark" ? "Tema claro" : "Tema escuro"}</span>
            <i className={theme === "dark" ? "active" : ""}>
              <span />
            </i>
          </button>
          <div className="sidebar-profile-menu">
            <button
              className="sidebar-profile"
              onClick={() => setProfileOpen((current) => !current)}
              aria-expanded={profileOpen}
              aria-controls="account-menu"
            >
              <span className="avatar avatar--primary">
                {profileInitials || "OB"}
              </span>
              <span>
                <strong>{profileName}</strong>
                <small>{profileRole}</small>
              </span>
              <ChevronDown
                className={profileOpen ? "is-open" : ""}
                size={15}
              />
            </button>
            {profileOpen && (
              <div className="profile-popover" id="account-menu">
                <span className="profile-popover-role">
                  <ShieldCheck size={15} />
                  {profileRole}
                </span>
                <strong>{profileName}</strong>
                <small>{profileEmail}</small>
                <button onClick={handleSignOut} disabled={signingOut}>
                  <LogOut size={16} />
                  {signingOut ? "Saindo…" : "Sair desta conta"}
                </button>
              </div>
            )}
          </div>
          <button
            className="nav-item sidebar-logout"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut size={18} />
            <span>{signingOut ? "Saindo…" : "Sair"}</span>
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button
          className="mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      <div className="app-column">
        <header className="topbar refined-topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="topbar-spacer" />
          <button
            className="topbar-theme-toggle"
            onClick={onToggleTheme}
            aria-label={
              theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
            }
            title={theme === "dark" ? "Tema claro" : "Tema escuro"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>
        <main className="app-main">{children}</main>
        <nav className="mobile-bottom-nav" aria-label="Atalhos principais">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={active === item.key ? "active" : ""}
                onClick={() => navigate(item.key)}
                aria-current={active === item.key ? "page" : undefined}
              >
                <Icon size={21} strokeWidth={1.9} />
                <span>
                  {item.key === "prospecting" ? "Prospectar" : item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
