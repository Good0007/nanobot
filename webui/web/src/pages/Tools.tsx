import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import MCPServers from "./MCPServers";
import Skills from "./Skills";

export default function Tools() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "mcp";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="mcp">{t("mcp.title")}</TabsTrigger>
          <TabsTrigger value="skills">{t("skills.title")}</TabsTrigger>
        </TabsList>
        <TabsContent value="mcp" className="mt-4">
          <MCPServers hideTitle />
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <Skills hideTitle />
        </TabsContent>
      </Tabs>
    </div>
  );
}
