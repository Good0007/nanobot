import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useMCPServers,
  useCreateMCPServer,
  useUpdateMCPServer,
  useDeleteMCPServer,
  type MCPServer,
} from "../hooks/useMCP";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { ConfirmDialog } from "../components/shared/ConfirmDialog";
import { Skeleton } from "../components/ui/skeleton";
import { Plus, Pencil, Trash2, Terminal, Globe } from "lucide-react";

type McpType = "stdio" | "http" | "sse";

export default function MCPServers({ hideTitle }: { hideTitle?: boolean } = {}) {
  const { t } = useTranslation();
  const { data: servers, isLoading } = useMCPServers();
  const create = useCreateMCPServer();
  const update = useUpdateMCPServer();
  const del = useDeleteMCPServer();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MCPServer | null>(null);
  const [delTarget, setDelTarget] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [mcpType, setMcpType] = useState<McpType>("stdio");
  const [command, setCommand] = useState("");
  const [argsStr, setArgsStr] = useState("");
  const [envStr, setEnvStr] = useState("");
  const [url, setUrl] = useState("");
  const [headersStr, setHeadersStr] = useState("");
  const [timeout, setTimeout_] = useState("30");

  const isRemote = mcpType !== "stdio";

  const openCreate = () => {
    setEditing(null);
    setName(""); setMcpType("stdio"); setCommand(""); setArgsStr("");
    setEnvStr(""); setUrl(""); setHeadersStr(""); setTimeout_("30");
    setOpen(true);
  };

  const openEdit = (s: MCPServer) => {
    setEditing(s);
    setName(s.name);
    const t = (s.type as McpType) || "stdio";
    setMcpType(t);
    setCommand(s.command ?? "");
    setArgsStr((s.args ?? []).join(" "));
    setEnvStr(Object.entries(s.env ?? {}).map(([k, v]) => `${k}=${v}`).join("\n"));
    setUrl(s.url ?? "");
    setHeadersStr(Object.entries(s.headers ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n"));
    setTimeout_(String(s.timeout ?? 30));
    setOpen(true);
  };

  const parseEnv = (raw: string): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const eq = line.indexOf("=");
      if (eq > 0) result[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    return result;
  };

  const parseHeaders = (raw: string): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const idx = line.indexOf(":");
      if (idx > 0) result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return result;
  };

  const handleSave = () => {
    const data: MCPServer = {
      name,
      type: mcpType,
      command: isRemote ? "" : command,
      args: isRemote ? [] : argsStr.split(/\s+/).filter(Boolean),
      env: isRemote ? {} : parseEnv(envStr),
      url: isRemote ? url : "",
      headers: isRemote ? parseHeaders(headersStr) : {},
      timeout: Number(timeout) || 30,
    };
    if (editing) {
      update.mutate({ name: editing.name, data });
    } else {
      create.mutate(data);
    }
    setOpen(false);
  };

  const canSave = !!name && (isRemote ? !!url : !!command);

  return (
    <div className="space-y-4">
      <div className={hideTitle ? "flex justify-end" : "flex items-center justify-between"}>
        {!hideTitle && <h1 className="text-2xl font-semibold">{t("mcp.title")}</h1>}
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("mcp.add")}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("mcp.name")}</TableHead>
                <TableHead>{t("mcp.type")}</TableHead>
                <TableHead>{t("mcp.command")}</TableHead>
                <TableHead className="w-24 text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servers?.map((s) => {
                const remote = s.type && s.type !== "stdio";
                return (
                  <TableRow key={s.name}>
                    <TableCell className="font-mono">{s.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1 text-xs">
                        {remote ? <Globe className="h-3 w-3" /> : <Terminal className="h-3 w-3" />}
                        {s.type || "stdio"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground max-w-xs truncate">
                      {remote ? s.url : `${s.command} ${(s.args ?? []).join(" ")}`}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                        onClick={() => setDelTarget(s.name)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!servers || servers.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("mcp.edit") : t("mcp.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Name */}
            <div className="space-y-1">
              <Label>{t("mcp.name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!!editing} />
            </div>

            {/* Type selector */}
            <div className="space-y-1">
              <Label>{t("mcp.type")}</Label>
              <Select value={mcpType} onValueChange={(v) => setMcpType(v as McpType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stdio">
                    <span className="flex items-center gap-2"><Terminal className="h-3.5 w-3.5" /> stdio — {t("mcp.typeStdioDesc")}</span>
                  </SelectItem>
                  <SelectItem value="http">
                    <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> http — {t("mcp.typeHttpDesc")}</span>
                  </SelectItem>
                  <SelectItem value="sse">
                    <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> sse — {t("mcp.typeSseDesc")}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Remote fields */}
            {isRemote ? (
              <>
                <div className="space-y-1">
                  <Label>{t("mcp.url")}</Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://mcp.example.com/sse" />
                </div>
                <div className="space-y-1">
                  <Label>{t("mcp.headers")} ({t("common.optional")})</Label>
                  <textarea
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono h-20 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    value={headersStr}
                    onChange={(e) => setHeadersStr(e.target.value)}
                    placeholder={"Authorization: Bearer <token>\nX-Custom: value"}
                  />
                  <p className="text-xs text-muted-foreground">{t("mcp.headersHint")}</p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>{t("mcp.command")}</Label>
                  <Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx" />
                </div>
                <div className="space-y-1">
                  <Label>{t("mcp.args")} ({t("common.optional")})</Label>
                  <Input value={argsStr} onChange={(e) => setArgsStr(e.target.value)}
                    placeholder="-y @modelcontextprotocol/server-github" />
                </div>
                <div className="space-y-1">
                  <Label>{t("mcp.env")} ({t("common.optional")})</Label>
                  <textarea
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono h-24 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    value={envStr}
                    onChange={(e) => setEnvStr(e.target.value)}
                    placeholder={"GITHUB_TOKEN=xxx\nSOME_KEY=value"}
                  />
                </div>
              </>
            )}

            {/* Timeout */}
            <div className="space-y-1">
              <Label>{t("mcp.timeout")} (s)</Label>
              <Input type="number" value={timeout} onChange={(e) => setTimeout_(e.target.value)} className="w-32" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={!canSave}>{t("mcp.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!delTarget}
        title={t("mcp.delete")}
        description={t("mcp.deleteConfirm")}
        destructive
        onConfirm={() => { if (delTarget) del.mutate(delTarget); setDelTarget(null); }}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}
