import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { nanoid } from "nanoid";
import { useChatStore } from "../../stores/chatStore";
import { useAuthStore } from "../../stores/authStore";
import { ChatWebSocket, type WsMessage } from "../../lib/ws";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ScrollArea } from "../ui/scroll-area";

export function ChatWindow() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const {
    currentSessionKey,
    messages,
    isWaiting,
    progressText,
    addMessage,
    setWaiting,
    setProgress,
    setCurrentSession,
  } = useChatStore();

  const wsRef = useRef<ChatWebSocket | null>(null);
  const assistantMsgIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const handleWsMessageRef = useRef<(msg: WsMessage) => void>(() => {});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new ChatWebSocket(
      (msg) => handleWsMessageRef.current(msg),
      (connected) => setIsConnected(connected),
    );
    wsRef.current = ws;
    ws.connect();
    return () => {
      ws.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!currentSessionKey && user) {
      const key = `web:${user.id}:${nanoid(8)}`;
      setCurrentSession(key);
    }
  }, [user, currentSessionKey, setCurrentSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, progressText]);

  const handleWsMessage = useCallback(
    (msg: WsMessage) => {
      if (msg.type === "session_info") {
        if (msg.session_key) setCurrentSession(msg.session_key);
      } else if (msg.type === "progress") {
        setProgress(msg.content ?? "");
      } else if (msg.type === "done") {
        setProgress("");
        setWaiting(false);
        if (assistantMsgIdRef.current) {
          useChatStore.getState().setStreaming(assistantMsgIdRef.current, false);
          assistantMsgIdRef.current = null;
        }
        if (msg.content?.trim()) {
          addMessage({
            id: nanoid(),
            role: "assistant",
            content: msg.content,
            timestamp: new Date().toISOString(),
          });
        }
      } else if (msg.type === "error") {
        setProgress("");
        setWaiting(false);
        addMessage({
          id: nanoid(),
          role: "assistant",
          content: `⚠️ ${msg.content ?? t("common.error")}`,
          timestamp: new Date().toISOString(),
        });
      }
    },
    [addMessage, setCurrentSession, setProgress, setWaiting, t]
  );

  useEffect(() => {
    handleWsMessageRef.current = handleWsMessage;
  }, [handleWsMessage]);

  const handleSend = useCallback(
    (content: string) => {
      if (!wsRef.current?.isConnected) {
        wsRef.current?.connect();
      }
      addMessage({
        id: nanoid(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      });
      setWaiting(true);
      setProgress(t("chat.thinking"));
      wsRef.current?.send(content, currentSessionKey ?? undefined);
    },
    [addMessage, currentSessionKey, setProgress, setWaiting, t]
  );

  const handleStop = useCallback(() => {
    wsRef.current?.cancel();
    setWaiting(false);
    setProgress("");
  }, [setProgress, setWaiting]);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[200px] items-center justify-center">
            <div className="text-center space-y-2">
              <div className="text-4xl">✦</div>
              <p className="text-sm text-muted-foreground">{t("chat.noMessages")}</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
        {isWaiting && progressText && (
          <div className="mx-auto max-w-3xl mt-4 flex items-start gap-3 px-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white text-xs font-bold">
              N
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
              </span>
              <span className="truncate max-w-xs">{progressText}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>
      <ChatInput
        onSend={handleSend}
        disabled={isWaiting}
        onStop={handleStop}
        isWaiting={isWaiting}
        isConnected={isConnected}
      />
    </div>
  );
}
