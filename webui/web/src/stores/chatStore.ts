import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  toolCalls?: ToolCallInfo[];
  name?: string; // tool result: the tool's name
}

export interface ToolCallInfo {
  id: string;
  name: string;
  input?: string;
  output?: string;
}

interface ChatState {
  currentSessionKey: string | null;
  messages: ChatMessage[];
  isWaiting: boolean;
  progressText: string;
  setCurrentSession: (key: string | null) => void;
  addMessage: (msg: ChatMessage) => void;
  appendAssistantText: (id: string, text: string) => void;
  setStreaming: (id: string, isStreaming: boolean) => void;
  setProgress: (text: string) => void;
  setWaiting: (v: boolean) => void;
  clearMessages: () => void;
  setMessages: (msgs: ChatMessage[]) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  currentSessionKey: null,
  messages: [],
  isWaiting: false,
  progressText: "",

  setCurrentSession: (key) =>
    set({ currentSessionKey: key, messages: [], progressText: "" }),

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  appendAssistantText: (id, text) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + text } : m
      ),
    })),

  setStreaming: (id, isStreaming) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, isStreaming } : m
      ),
    })),

  setProgress: (progressText) => set({ progressText }),

  setWaiting: (isWaiting) => set({ isWaiting }),

  clearMessages: () => set({ messages: [], progressText: "" }),

  setMessages: (messages) => set({ messages }),
}));
