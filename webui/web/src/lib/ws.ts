import { useAuthStore } from "../stores/authStore";

export type WsMessageType = "session_info" | "progress" | "done" | "error";

export interface WsMessage {
  type: WsMessageType;
  content?: string;
  session_key?: string;
}

type MessageHandler = (msg: WsMessage) => void;
type StatusHandler = (connected: boolean) => void;

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private onMessage: MessageHandler;
  private onStatusChange: StatusHandler | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  private url: string;

  constructor(onMessage: MessageHandler, onStatusChange?: StatusHandler) {
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange ?? null;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host;
    this.url = `${proto}://${host}/ws/chat`;
  }

  connect() {
    const token = useAuthStore.getState().token;
    if (!token) return;

    this.shouldReconnect = true;

    const wsUrl = `${this.url}?token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.onStatusChange?.(true);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        this.onMessage(msg);
      } catch {
        // ignore malformed frames
      }
    };

    this.ws.onclose = () => {
      this.onStatusChange?.(false);
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  send(content: string, sessionKey?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "message", content, session_key: sessionKey }));
    }
  }

  cancel() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "cancel" }));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
