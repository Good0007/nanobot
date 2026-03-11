import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../lib/api";

export interface SessionInfo {
  key: string;
  created_at: string;
  updated_at: string;
}

export interface MessageInfo {
  role: string;
  content: string | null;
  timestamp?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
  name?: string;
}

export function useSessions() {
  return useQuery<SessionInfo[]>({
    queryKey: ["sessions"],
    queryFn: () => api.get("/sessions").then((r) => r.data),
  });
}

export function useSessionMessages(key: string) {
  return useQuery<MessageInfo[]>({
    queryKey: ["sessions", key, "messages"],
    queryFn: () =>
      api.get(`/sessions/${encodeURIComponent(key)}/messages`).then((r) => r.data),
    enabled: !!key,
  });
}

export function useSessionMemory(key: string) {
  return useQuery<MessageInfo[]>({
    queryKey: ["sessions", key, "memory"],
    queryFn: () =>
      api.get(`/sessions/${encodeURIComponent(key)}/memory`).then((r) => r.data),
    enabled: !!key,
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      api.delete(`/sessions/${encodeURIComponent(key)}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Session deleted");
    },
  });
}
