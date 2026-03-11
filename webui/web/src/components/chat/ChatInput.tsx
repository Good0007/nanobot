import { useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Send, Square, Wifi, WifiOff } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { cn } from "../../lib/utils";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  onStop?: () => void;
  isWaiting?: boolean;
  isConnected?: boolean;
}

export function ChatInput({
  onSend,
  disabled,
  onStop,
  isWaiting,
  isConnected = true,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  return (
    <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-3xl px-4 py-3">
        <div className={cn(
          "relative flex flex-col rounded-2xl border bg-background shadow-sm transition-all",
          isWaiting ? "border-primary/40" : "focus-within:border-primary/60 focus-within:shadow-md"
        )}>
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.placeholder")}
            rows={1}
            className="min-h-[52px] max-h-[160px] flex-1 resize-none border-0 bg-transparent px-4 py-3.5 shadow-none focus-visible:ring-0 text-sm leading-relaxed"
            disabled={!isWaiting && disabled}
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {isConnected ? (
                <Wifi className="h-3 w-3 text-green-500" />
              ) : (
                <WifiOff className="h-3 w-3 text-destructive" />
              )}
              <span>{isConnected ? t("chat.connected") : t("chat.disconnected")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {isWaiting ? "" : t("chat.hint")}
              </span>
              {isWaiting ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onStop}
                  className="h-8 gap-1.5 rounded-xl px-3"
                >
                  <Square className="h-3.5 w-3.5" />
                  {t("chat.stop")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!value.trim() || disabled}
                  className="h-8 gap-1.5 rounded-xl px-3"
                >
                  <Send className="h-3.5 w-3.5" />
                  {t("chat.send")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
