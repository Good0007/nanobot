import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProviders, useUpdateProvider, getProviderLabel } from "../hooks/useProviders";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { SecretInput } from "../components/shared/SecretInput";
import { Skeleton } from "../components/ui/skeleton";
import { isMasked } from "../lib/utils";

export default function Providers() {
  const { t } = useTranslation();
  const { data: providers, isLoading } = useProviders();
  const update = useUpdateProvider();

  const [drafts, setDrafts] = useState<Record<string, { api_key: string; api_base: string }>>({});

  const getDraft = (name: string, field: "api_key" | "api_base", original: string) =>
    drafts[name]?.[field] ?? original;

  const setDraft = (name: string, field: "api_key" | "api_base", value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [name]: { ...(prev[name] ?? { api_key: "", api_base: "" }), [field]: value },
    }));
  };

  const handleSave = (name: string, original: { api_key: string; api_base: string }) => {
    const draft = drafts[name] ?? original;
    update.mutate({
      name,
      api_key: isMasked(draft.api_key) ? undefined : draft.api_key || undefined,
      api_base: draft.api_base || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {providers?.map((p) => {
            const apiKey = getDraft(p.name, "api_key", p.api_key_masked);
            const apiBase = getDraft(p.name, "api_base", p.api_base ?? "");
            return (
              <Card key={p.name}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">{getProviderLabel(p.name)}</CardTitle>
                  <Badge variant={p.has_key ? "default" : "secondary"}>
                    {p.has_key ? t("providers.configured") : t("providers.notConfigured")}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("providers.apiKey")}</Label>
                    <SecretInput
                      value={apiKey}
                      onChange={(v) => setDraft(p.name, "api_key", v)}
                      placeholder="sk-..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("providers.apiBase")} ({t("common.optional")})</Label>
                    <Input
                      value={apiBase}
                      onChange={(e) => setDraft(p.name, "api_base", e.target.value)}
                      placeholder="https://api.openai.com/v1"
                      className="text-sm"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSave(p.name, { api_key: p.api_key_masked, api_base: p.api_base ?? "" })}
                    disabled={update.isPending}
                  >
                    {t("providers.save")}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
