import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../lib/api";

export interface ProviderInfo {
  name: string;
  api_key_masked: string;
  api_base: string | null;
  has_key: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  groq: "Groq",
  zhipu: "Zhipu AI",
  dashscope: "DashScope (Alibaba)",
  vllm: "vLLM",
  gemini: "Google Gemini",
  moonshot: "Moonshot",
  minimax: "MiniMax",
  aihubmix: "AiHubMix",
  siliconflow: "SiliconFlow",
  volcengine: "VolcEngine",
  azure_openai: "Azure OpenAI",
  custom: "Custom",
  openai_codex: "OpenAI Codex",
  github_copilot: "GitHub Copilot",
};

export function getProviderLabel(name: string): string {
  return PROVIDER_LABELS[name] ?? name;
}

export function useProviders() {
  return useQuery<ProviderInfo[]>({
    queryKey: ["providers"],
    queryFn: () => api.get("/providers").then((r) => r.data),
  });
}

export function useUpdateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      api_key,
      api_base,
    }: {
      name: string;
      api_key?: string;
      api_base?: string;
    }) => api.patch(`/providers/${name}`, { api_key, api_base }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
      toast.success("Saved");
    },
  });
}
