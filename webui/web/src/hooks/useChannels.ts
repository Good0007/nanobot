import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../lib/api";

export interface ChannelStatus {
  name: string;
  enabled: boolean;
  running: boolean;
  error: string | null;
  config: Record<string, unknown>;
}

export function useChannels() {
  return useQuery<ChannelStatus[]>({
    queryKey: ["channels"],
    queryFn: () => api.get("/channels").then((r) => r.data),
  });
}

export function useUpdateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: Record<string, unknown> }) =>
      api.patch(`/channels/${name}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast.success("Saved");
    },
  });
}

export function useReloadChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post(`/channels/${name}/reload`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast.success("Reloaded");
    },
  });
}

export function useReloadAllChannels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/channels/reload-all").then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast.success("All channels reloaded");
    },
  });
}

export function useToggleChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      api.patch(`/channels/${name}`, { enabled }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
    },
  });
}
