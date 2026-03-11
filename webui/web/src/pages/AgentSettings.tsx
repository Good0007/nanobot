import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAgentSettings, useUpdateAgentSettings, useGatewayConfig, useUpdateGatewayConfig } from "../hooks/useConfig";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const PROVIDERS = [
  "auto", "anthropic", "openai", "openrouter", "deepseek", "volcengine",
  "groq", "zhipu", "dashscope", "vllm", "gemini", "moonshot", "minimax",
  "aihubmix", "siliconflow", "azure_openai", "custom",
];

const REASONING_EFFORT_OPTIONS = ["__default__", "none", "low", "medium", "high"];

export default function AgentSettings() {
  const { t } = useTranslation();
  const { data: agent, isLoading: loadingAgent } = useAgentSettings();
  const { data: gateway, isLoading: loadingGateway } = useGatewayConfig();
  const updateAgent = useUpdateAgentSettings();
  const updateGateway = useUpdateGatewayConfig();

  // Agent form
  const [model, setModel] = useState("");
  const [provider, setProvider] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [temperature, setTemperature] = useState("");
  const [maxToolIter, setMaxToolIter] = useState("");
  const [memoryWindow, setMemoryWindow] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [agentInited, setAgentInited] = useState(false);

  if (agent && !agentInited) {
    setModel(agent.model ?? "");
    setProvider(agent.provider ?? "");
    setMaxTokens(String(agent.max_tokens ?? ""));
    setTemperature(String(agent.temperature ?? ""));
    setMaxToolIter(String(agent.max_tool_iterations ?? ""));
    setMemoryWindow(String(agent.memory_window ?? ""));
    setReasoningEffort(agent.reasoning_effort || "__default__");
    setWorkspace(agent.workspace ?? "");
    setAgentInited(true);
  }

  const handleSaveAgent = () => {
    updateAgent.mutate({
      model: model || undefined,
      provider: provider || undefined,
      max_tokens: maxTokens ? Number(maxTokens) : undefined,
      temperature: temperature ? Number(temperature) : undefined,
      max_tool_iterations: maxToolIter ? Number(maxToolIter) : undefined,
      memory_window: memoryWindow ? Number(memoryWindow) : undefined,
      reasoning_effort: (reasoningEffort && reasoningEffort !== "__default__") ? reasoningEffort : undefined,
      workspace: workspace || undefined,
    }, {
      onSuccess: () => toast.success(t("settings.saved")),
    });
  };

  // Gateway form
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(false);
  const [heartbeatInterval, setHeartbeatInterval] = useState("");
  const [gatewayInited, setGatewayInited] = useState(false);

  if (gateway && !gatewayInited) {
    setHost(gateway.host ?? "");
    setPort(String(gateway.port ?? ""));
    setHeartbeatEnabled(gateway.heartbeat_enabled ?? false);
    setHeartbeatInterval(String(gateway.heartbeat_interval ?? ""));
    setGatewayInited(true);
  }

  const handleSaveGateway = () => {
    updateGateway.mutate({
      host: host || undefined,
      port: port ? Number(port) : undefined,
      heartbeat_enabled: heartbeatEnabled,
      heartbeat_interval: heartbeatInterval ? Number(heartbeatInterval) : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingAgent ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>{t("settings.provider")}</Label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("settings.provider")} />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t("settings.model")}</Label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. claude-opus-4-5" />
                </div>
                <div className="space-y-1">
                  <Label>{t("settings.maxTokens")}</Label>
                  <Input type="number" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("settings.temperature")}</Label>
                  <Input type="number" step="0.1" min="0" max="2" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("settings.maxToolIterations")}</Label>
                  <Input type="number" value={maxToolIter} onChange={(e) => setMaxToolIter(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("settings.memoryWindow")}</Label>
                  <Input type="number" value={memoryWindow} onChange={(e) => setMemoryWindow(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("settings.reasoningEffort")}</Label>
                  <Select value={reasoningEffort} onValueChange={setReasoningEffort}>
                    <SelectTrigger>
                      <SelectValue placeholder="— default —" />
                    </SelectTrigger>
                    <SelectContent>
                      {REASONING_EFFORT_OPTIONS.map((e) => (
                        <SelectItem key={e} value={e}>{e === "__default__" ? "— default —" : e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t("settings.workspace")}</Label>
                  <Input value={workspace} onChange={(e) => setWorkspace(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleSaveAgent} disabled={updateAgent.isPending}>
                {t("settings.save")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.gateway")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingGateway ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>{t("settings.host")}</Label>
                  <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="0.0.0.0" />
                </div>
                <div className="space-y-1">
                  <Label>{t("settings.port")}</Label>
                  <Input type="number" value={port} onChange={(e) => setPort(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={heartbeatEnabled} onCheckedChange={setHeartbeatEnabled} id="hb-enabled" />
                <Label htmlFor="hb-enabled">{t("settings.heartbeat")}</Label>
              </div>
              {heartbeatEnabled && (
                <div className="space-y-1 max-w-xs">
                  <Label>{t("settings.heartbeatInterval")}</Label>
                  <Input type="number" value={heartbeatInterval} onChange={(e) => setHeartbeatInterval(e.target.value)} />
                </div>
              )}
              <Button onClick={handleSaveGateway} disabled={updateGateway.isPending}>
                {t("settings.save")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
