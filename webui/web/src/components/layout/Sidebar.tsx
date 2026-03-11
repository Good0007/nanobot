import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../stores/authStore";
import { cn } from "../../lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  Radio,
  Puzzle,
  Clock,
  Settings,
  Users,
} from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const GENERAL_ITEMS: NavItem[] = [
  { path: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
  { path: "/chat", label: "nav.chat", icon: MessageSquare },
];

const ADMIN_ITEMS: NavItem[] = [
  { path: "/channels", label: "nav.channels", icon: Radio },
  { path: "/tools", label: "nav.tools", icon: Puzzle },
  { path: "/settings", label: "nav.settings", icon: Settings },
  { path: "/users", label: "nav.users", icon: Users },
   { path: "/cron", label: "nav.cron", icon: Clock },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-all duration-150",
        active
          ? "bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active-fg))]"
          : "text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-[hsl(var(--sidebar-fg))]"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-[hsl(var(--primary))] opacity-90" />
      )}
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active
            ? "text-[hsl(var(--sidebar-active-fg))]"
            : "text-[hsl(var(--sidebar-muted))] group-hover:text-[hsl(var(--sidebar-fg))]"
        )}
      />
      {t(item.label)}
    </Link>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  const isActive = (item: NavItem) =>
    location.pathname === item.path ||
    (item.path !== "/dashboard" && location.pathname.startsWith(item.path));

  return (
    <aside
      className="flex h-full w-48 flex-col backdrop-blur-md"
      style={{
        background: "hsl(var(--sidebar-bg) / var(--sidebar-glass-opacity))",
        boxShadow: "var(--sidebar-edge-shadow)",
      }}
    >
      {/* Logo */}
      <div className="flex h-12 items-center gap-2 px-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[hsl(var(--primary))] text-white text-sm shadow-sm">
          🤖
        </div>
        <span
          className="text-sm font-semibold tracking-tight"
          style={{ color: "hsl(var(--sidebar-fg))" }}
        >
          Nanobot
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {/* General section */}
        <div className="mb-1">
          <p
            className="mb-0.5 px-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "hsl(var(--sidebar-section-label))" }}
          >
            {t("nav.section.general")}
          </p>
          <div className="space-y-0.5">
            {GENERAL_ITEMS.map((item) => (
              <NavLink key={item.path} item={item} active={isActive(item)} />
            ))}
          </div>
        </div>

        {/* Admin section */}
        {isAdmin && (
          <div className="mt-3">
            <p
              className="mb-0.5 px-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "hsl(var(--sidebar-section-label))" }}
            >
              {t("nav.section.admin")}
            </p>
            <div className="space-y-0.5">
              {ADMIN_ITEMS.map((item) => (
                <NavLink key={item.path} item={item} active={isActive(item)} />
              ))}
            </div>
          </div>
        )}
      </nav>

    </aside>
  );
}
