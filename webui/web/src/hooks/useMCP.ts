import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../lib/api";

export interface MCPServer {
  name: string;
  type?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export function useMCPServers() {
  return useQuery<MCPServer[]>({
    queryKey: ["mcp", "servers"],
    queryFn: () => api.get("/mcp/servers").then((r) => r.data),
  });
}

export function useCreateMCPServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MCPServer) =>
      api.post("/mcp/servers", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mcp", "servers"] });
      toast.success("Created");
    },
  });
}

export function useUpdateMCPServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: Partial<MCPServer> }) =>
      api.put(`/mcp/servers/${name}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mcp", "servers"] });
      toast.success("Saved");
    },
  });
}

export function useDeleteMCPServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.delete(`/mcp/servers/${name}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mcp", "servers"] });
      toast.success("Deleted");
    },
  });
}
