import {
  Bell,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Eye,
  Home,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  Search,
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
  { key: "finance", label: "Financeiro", icon: CircleDollarSign },
  { key: "messages", label: "Mensagens", icon: MessageSquareText },
];

const mobileNavItems = navItems.filter((item) =>
  ["dashboard", "validation", "prospecting", "leads", "previews"].includes(
    item.key,
  ),
);

interface AppShellProps {
  active: NavKey;
  theme: "light" | "dark";
  onNavigate: (key: NavKey) => void;
  onToggleTheme: () => void;
  children: ReactNode;
}

export function AppShell({
  active,
  theme,
  onNavigate,
  onToggleTheme,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigate = (key: NavKey) => {
    onNavigate(key);
    setMobileOpen(false);
  };

  return (
    <div className="app-shell refined-shell">
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
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={`nav-item ${active === item.key ? "active" : ""}`}
                onClick={() => navigate(item.key)}
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
          <button className="sidebar-profile">
            <span className="avatar avatar--primary">V</span>
            <span>
              <strong>Você</strong>
              <small>Operador</small>
            </span>
            <ChevronDown size={15} />
          </button>
          <button className="nav-item sidebar-logout">
            <LogOut size={18} />
            <span>Sair</span>
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
            <span>O</span>
            <strong>OBLIX CRM</strong>
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
          <button className="notification-button" aria-label="Notificações">
            <Bell size={19} strokeWidth={1.75} />
            <span>2</span>
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
              >
                <Icon size={21} strokeWidth={1.9} />
                <span>{item.key === "messages" ? "Mais" : item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
