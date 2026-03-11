import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChatWindow } from "../components/chat/ChatWindow";
import { useChatStore } from "../stores/chatStore";
import { useSessions, useSessionMessages } from "../hooks/useSessions";
import { useAuthStore } from "../stores/authStore";
import { useDeleteSession } from "../hooks/useSessions";
import { nanoid } from "nanoid";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Plus, Trash2 } from "lucide-react";
import { cn, formatDate } from "../lib/utils";

export default function Chat() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { currentSessionKey, setCurrentSession, setMessages } = useChatStore();
  const { data: sessions } = useSessions();
  const { data: sessionMsgs, isSuccess: historyLoaded } = useSessionMessages(currentSessionKey ?? "");
  const deleteSession = useDeleteSession();
  const historyLoadedForRef = useRef<string | null>(null);

  // Populate store with historical messages whenever the active session changes
  useEffect(() => {
    if (
      currentSessionKey &&
      historyLoaded &&
      historyLoadedForRef.current !== currentSessionKey
    ) {
      historyLoadedForRef.current = currentSessionKey;
      // Filter out empty messages only (assistant stubs with null/empty content).
      // tool and system messages are included but rendered differently.
      const msgs = (sessionMsgs ?? [])
        .filter((m) =>
          typeof m.content === "string" &&
          m.content.trim().length > 0
        )
        .map((m) => ({
          id: nanoid(),
          role: m.role as "user" | "assistant" | "tool" | "system",
          content: m.content as string,
          timestamp: m.timestamp ?? new Date().toISOString(),
          name: m.name ?? undefined,
        }));
      setMessages(msgs);
    }
  }, [currentSessionKey, historyLoaded, sessionMsgs, setMessages]);

  const myPrefix = `web:${user?.id}:`;
  const mySessions = sessions?.filter((s) => s.key.startsWith(myPrefix)) ?? [];

  const newChat = () => {
    const key = `web:${user?.id}:${nanoid(8)}`;
    historyLoadedForRef.current = key; // new session has no history
    setCurrentSession(key);
  };

  const switchSession = (key: string) => {
    setCurrentSession(key); // clears messages in store
  };

  return (
    <div className="flex h-[calc(100vh-3rem-1.5rem*2)] gap-4">
      {/* Session sidebar */}
      <aside className="flex w-52 shrink-0 flex-col rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">{t("chat.sessions")}</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={newChat}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-0.5 p-1">
            {mySessions.map((s) => {
              const label = s.key.split(":")[2] ?? s.key;
              const active = s.key === currentSessionKey;
              return (
                <div
                  key={s.key}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                  onClick={() => switchSession(s.key)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono">{label}</div>
                    <div
                      className={cn(
                        "text-[10px]",
                        active ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}
                    >
                      {formatDate(s.updated_at)}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100",
                      active && "opacity-100"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession.mutate(s.key);
                      if (active) newChat();
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
            {mySessions.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                {t("common.noData")}
              </p>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Chat area */}
      <div className="flex flex-1 flex-col rounded-lg border bg-card overflow-hidden">
        <ChatWindow />
      </div>
    </div>
  );
}
