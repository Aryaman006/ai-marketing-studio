import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Layout, Loader2, Trash2, Plus, Play, FileText, Globe, Image, BookOpen, Copy, Shield } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

const TEMPLATE_TYPES = [
  { value: "post", label: "Social Post", icon: FileText, route: "/posts" },
  { value: "blog", label: "Blog Post", icon: BookOpen, route: "/blogs" },
  { value: "asset", label: "Image Asset", icon: Image, route: "/assets" },
  { value: "landing", label: "Landing Page", icon: Globe, route: "/landing-pages" },
];

interface TemplateConfig {
  topic?: string;
  tone?: string;
  style?: string;
  assetType?: string;
}

export default function Templates() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("post");
  const [configTopic, setConfigTopic] = useState("");
  const [configTone, setConfigTone] = useState("professional");
  const [configStyle, setConfigStyle] = useState("informative");
  const [configAssetType, setConfigAssetType] = useState("ad_banner");

  // System templates (admin-created, visible to all)
  const { data: systemTemplates, isLoading: loadingSystem } = useQuery({
    queryKey: ["system-templates"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("templates") as any)
        .select("*")
        .eq("is_system", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // User's own cloned templates
  const { data: myTemplates, isLoading: loadingMy } = useQuery({
    queryKey: ["my-templates", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("templates") as any)
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_system", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Admin: create system template
  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Name is required");

      const config: TemplateConfig = { topic: configTopic.trim() || undefined };
      if (type === "post") config.tone = configTone;
      if (type === "blog") config.style = configStyle;
      if (type === "asset") config.assetType = configAssetType;

      const { error } = await (supabase.from("templates") as any).insert({
        user_id: user!.id,
        name: trimmedName,
        type,
        config,
        is_system: isAdmin,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template saved!");
      setShowCreate(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["system-templates"] });
      queryClient.invalidateQueries({ queryKey: ["my-templates"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Clone a system template
  const cloneMutation = useMutation({
    mutationFn: async (template: any) => {
      const { error } = await (supabase.from("templates") as any).insert({
        user_id: user!.id,
        name: `${template.name} (My Copy)`,
        type: template.type,
        config: template.config,
        is_system: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template cloned to your collection!");
      queryClient.invalidateQueries({ queryKey: ["my-templates"] });
    },
    onError: () => toast.error("Failed to clone"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("templates") as any)
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template deleted");
      queryClient.invalidateQueries({ queryKey: ["system-templates"] });
      queryClient.invalidateQueries({ queryKey: ["my-templates"] });
    },
    onError: () => toast.error("Failed to delete"),
  });

  const resetForm = () => {
    setName("");
    setType("post");
    setConfigTopic("");
    setConfigTone("professional");
    setConfigStyle("informative");
    setConfigAssetType("ad_banner");
  };

  const useTemplate = (template: any) => {
    const route = TEMPLATE_TYPES.find((t) => t.value === template.type)?.route;
    if (route) {
      toast.info(`Navigate to ${TEMPLATE_TYPES.find(t => t.value === template.type)?.label} and use topic: "${(template.config as TemplateConfig)?.topic || ""}"`);
      navigate(route);
    }
  };

  const getTypeInfo = (typeValue: string) =>
    TEMPLATE_TYPES.find((t) => t.value === typeValue);

  const renderTemplateCard = (template: any, options: { isSystem: boolean; canDelete: boolean }) => {
    const typeInfo = getTypeInfo(template.type);
    const Icon = typeInfo?.icon ?? FileText;
    const config = template.config as TemplateConfig;

    return (
      <div
        key={template.id}
        className="group rounded-lg border border-border/50 bg-secondary/30 p-4 transition-colors hover:bg-secondary/50"
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{template.name}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(template.created_at), "MMM d, yyyy")}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs border-primary/30 text-primary capitalize">
            {typeInfo?.label ?? template.type}
          </Badge>
        </div>

        {config?.topic && (
          <p className="text-xs text-muted-foreground mb-1">Topic: {config.topic}</p>
        )}
        <div className="flex flex-wrap gap-1 mb-3">
          {config?.tone && <Badge variant="secondary" className="text-xs capitalize">{config.tone}</Badge>}
          {config?.style && <Badge variant="secondary" className="text-xs capitalize">{config.style}</Badge>}
          {config?.assetType && <Badge variant="secondary" className="text-xs">{config.assetType.replace("_", " ")}</Badge>}
        </div>

        <div className="flex gap-2">
          {options.isSystem && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => cloneMutation.mutate(template)}
              disabled={cloneMutation.isPending}
            >
              <Copy className="mr-1 h-3 w-3" />
              Clone
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => useTemplate(template)}
          >
            <Play className="mr-1 h-3 w-3" />
            Use
          </Button>
          {options.canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => deleteMutation.mutate(template.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const isLoading = loadingSystem || loadingMy;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
          {isAdmin && (
            <Button
              onClick={() => setShowCreate(true)}
              className="gradient-primary text-primary-foreground hover:opacity-90"
            >
              <Plus className="mr-2 h-4 w-4" />
              New System Template
            </Button>
          )}
        </div>

        {/* System Templates */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              System Templates
              {systemTemplates && <Badge variant="secondary" className="ml-auto text-xs">{systemTemplates.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !systemTemplates?.length ? (
              <p className="py-8 text-center text-muted-foreground">
                No system templates available yet.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {systemTemplates.map((t: any) =>
                  renderTemplateCard(t, { isSystem: true, canDelete: isAdmin && t.user_id === user?.id })
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Templates */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layout className="h-5 w-5 text-primary" />
              My Templates
              {myTemplates && <Badge variant="secondary" className="ml-auto text-xs">{myTemplates.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !myTemplates?.length ? (
              <p className="py-8 text-center text-muted-foreground">
                Clone a system template above to get started, or customize your own presets!
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {myTemplates.map((t: any) =>
                  renderTemplateCard(t, { isSystem: false, canDelete: true })
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Create Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create System Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  placeholder="e.g. Weekly LinkedIn post"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-secondary/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Topic (optional)</Label>
                <Input
                  placeholder="e.g. AI in marketing"
                  value={configTopic}
                  onChange={(e) => setConfigTopic(e.target.value)}
                  className="bg-secondary/50 border-border/50"
                />
              </div>

              {type === "post" && (
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Select value={configTone} onValueChange={setConfigTone}>
                    <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["professional", "casual", "humorous", "inspirational", "educational"].map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {type === "blog" && (
                <div className="space-y-2">
                  <Label>Style</Label>
                  <Select value={configStyle} onValueChange={setConfigStyle}>
                    <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["informative", "tutorial", "opinion", "listicle", "case-study"].map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {type === "asset" && (
                <div className="space-y-2">
                  <Label>Asset Type</Label>
                  <Select value={configAssetType} onValueChange={setConfigAssetType}>
                    <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ad_banner">Ad Banner</SelectItem>
                      <SelectItem value="social_media">Social Media</SelectItem>
                      <SelectItem value="logo">Logo</SelectItem>
                      <SelectItem value="icon">Icon</SelectItem>
                      <SelectItem value="thumbnail">Thumbnail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !name.trim()}
                className="gradient-primary text-primary-foreground"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
