import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Sun, Moon, Languages, LogOut, KeyRound } from "lucide-react";
import { useState } from "react";
import { ChangePasswordDialog } from "./ChangePasswordDialog";

const PAGE_TITLE_KEYS: Record<string, string> = {
  "/dashboard": "nav.dashboard",
  "/chat": "nav.chat",
  "/channels": "nav.channels",
  "/tools": "nav.tools",
  "/cron": "nav.cron",
  "/settings": "nav.settings",
  "/users": "nav.users",
};

export function Header() {
  const { t, i18n } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);
  const [showChangePwd, setShowChangePwd] = useState(false);

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === "zh" ? "en" : "zh");
  };

  const pageKey = Object.keys(PAGE_TITLE_KEYS).find(
    (k) => location.pathname === k || (k !== "/dashboard" && location.pathname.startsWith(k))
  );
  const pageTitle = pageKey ? t(PAGE_TITLE_KEYS[pageKey]) : "";

  return (
    <header className="flex h-12 items-center bg-background px-4">
      {/* Page title */}
      <div className="flex-1">
        {pageTitle && (
          <h1 className="text-sm font-semibold text-foreground">{pageTitle}</h1>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLang}
          title={t("common.language")}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <Languages className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          title={resolvedTheme === "dark" ? t("common.lightMode") : t("common.darkMode")}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              title={t("auth.account")}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {user?.username?.[0]?.toUpperCase() ?? "?"}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setShowChangePwd(true)}>
              <KeyRound className="mr-2 h-4 w-4" />
              {t("auth.changePassword")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={clearAuth}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t("auth.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChangePasswordDialog
        open={showChangePwd}
        onClose={() => setShowChangePwd(false)}
      />
    </header>
  );
}
