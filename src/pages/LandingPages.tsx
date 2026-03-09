import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCampaign } from "@/contexts/CampaignContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Globe, Loader2, Trash2, ExternalLink, Sparkles, Eye, Pencil,
  RefreshCw, ChevronDown, Upload, FileText, X, Megaphone, ImagePlus,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { LandingPageEditor } from "@/components/campaign/LandingPageEditor";

function generateSlug(topic: string): string {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) + "-" + Date.now().toString(36);
}

type LandingPage = {
  id: string; title: string | null; topic: string | null; slug: string | null;
  html_content: string | null; is_public: boolean; created_at: string; updated_at: string;
  user_id: string; campaign_id?: string | null;
};

export default function LandingPages() {
  const { user } = useAuth();
  const { campaigns } = useCampaign();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("none");
  const [generatorOpen, setGeneratorOpen] = useState(true);
  const [editingPage, setEditingPage] = useState<LandingPage | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceContent, setReferenceContent] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !user) return null;
    const ext = logoFile.name.split(".").pop() || "png";
    const path = `${user.id}/landing-logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("assets").upload(path, logoFile, { upsert: true });
    if (error) return null;
    const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleRefFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isText = file.type.startsWith("text/") ||
      [".txt", ".md", ".csv", ".json", ".html", ".css"].some(ext => file.name.endsWith(ext));
    try {
      const reader = new FileReader();
      reader.onload = () => {
        setReferenceContent((reader.result as string).slice(0, isText ? 30000 : 50000));
        setReferenceFile(file);
      };
      isText ? reader.readAsText(file) : reader.readAsDataURL(file);
    } catch {
      toast.error("Failed to read file");
    }
    e.target.value = "";
  };

  const { data: pages, isLoading } = useQuery({
    queryKey: ["landing-pages-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LandingPage[];
    },
    enabled: !!user,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const trimmedTopic = topic.trim();
      if (!trimmedTopic) throw new Error("Topic is required");

      let uploadedLogoUrl: string | null = null;
      if (logoFile) uploadedLogoUrl = await uploadLogo();

      const brandContext = selectedCampaign ? {
        brandTone: selectedCampaign.brand_tone, brandType: selectedCampaign.brand_type,
        brandColors: selectedCampaign.brand_colors, 
        logoUrl: uploadedLogoUrl || selectedCampaign.logo_url,
        targetAudience: selectedCampaign.target_audience,
      } : { logoUrl: uploadedLogoUrl };

      const { data: fnData, error: fnError } = await supabase.functions.invoke("generate-landing", {
        body: {
          topic: trimmedTopic,
          ...brandContext,
          faviconUrl: uploadedLogoUrl || undefined,
          fileContent: referenceContent || undefined,
          fileName: referenceFile?.name || undefined,
        },
      });
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      const html = fnData.html;
      const slug = generateSlug(trimmedTopic);
      const { error: insertError } = await supabase.from("landing_pages").insert({
        user_id: user!.id, title: trimmedTopic, topic: trimmedTopic,
        html_content: html, slug, is_public: true,
        campaign_id: selectedCampaignId !== "none" ? selectedCampaignId : null,
      });
      if (insertError) throw insertError;

      await supabase.functions.invoke("deduct-credits", { body: { amount: 2 } });
      return html;
    },
    onSuccess: () => {
      toast.success("Landing page generated!");
      setTopic("");
      setReferenceFile(null);
      setReferenceContent(null);
      setLogoFile(null);
      setLogoPreview(null);
      setGeneratorOpen(false);
      queryClient.invalidateQueries({ queryKey: ["landing-pages-all"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, is_public }: { id: string; is_public: boolean }) => {
      const { error } = await supabase.from("landing_pages").update({ is_public }).eq("id", id).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: (_, { is_public }) => {
      toast.success(is_public ? "Page is now public" : "Page is now private");
      queryClient.invalidateQueries({ queryKey: ["landing-pages-all"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("landing_pages").delete().eq("id", id).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Landing page deleted");
      queryClient.invalidateQueries({ queryKey: ["landing-pages-all"] });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (page: LandingPage) => {
      const pageTopic = page.topic || page.title || "landing page";
      const campaign = campaigns.find(c => c.id === page.campaign_id);
      const brandContext = campaign ? {
        brandTone: campaign.brand_tone, brandType: campaign.brand_type,
        brandColors: campaign.brand_colors, logoUrl: campaign.logo_url,
      } : {};

      const { data: fnData, error: fnError } = await supabase.functions.invoke("generate-landing", {
        body: { topic: pageTopic, ...brandContext },
      });
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      const { error } = await supabase.from("landing_pages").update({ html_content: fnData.html }).eq("id", page.id).eq("user_id", user!.id);
      if (error) throw error;

      await supabase.functions.invoke("deduct-credits", { body: { amount: 2 } });
    },
    onSuccess: () => {
      toast.success("Landing page regenerated!");
      queryClient.invalidateQueries({ queryKey: ["landing-pages-all"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const publicUrl = (slug: string) => `${window.location.origin}/public/landing/${slug}`;

  if (editingPage) {
    const campaign = campaigns.find(c => c.id === editingPage.campaign_id) || campaigns[0];
    if (campaign) {
      return (
        <DashboardLayout>
          <LandingPageEditor
            page={editingPage}
            campaign={campaign}
            onBack={() => setEditingPage(null)}
            onSaved={() => {
              setEditingPage(null);
              queryClient.invalidateQueries({ queryKey: ["landing-pages-all"] });
            }}
          />
        </DashboardLayout>
      );
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/10 p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Landing Pages</h1>
              </div>
              <p className="text-sm text-muted-foreground">Create SEO-optimized, high-converting landing pages with real stock photos</p>
            </div>
            <Badge variant="secondary" className="text-xs">{pages?.length ?? 0} pages</Badge>
          </div>
        </div>

        {/* Generator */}
        <Collapsible open={generatorOpen} onOpenChange={setGeneratorOpen}>
          <Card className="glass border-primary/10">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-secondary/20 transition-colors rounded-t-xl">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-primary" />Generate Landing Page
                    <Badge variant="secondary" className="text-[10px] ml-1">2 credits</Badge>
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${generatorOpen ? "rotate-180" : ""}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                <div className="space-y-2">
                  <Label className="text-xs">Topic / Product</Label>
                  <Input
                    placeholder="e.g. AI-powered project management tool"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && topic.trim() && generateMutation.mutate()}
                    maxLength={500}
                    className="bg-secondary/50 border-border/50"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Campaign selector */}
                  <div className="space-y-2">
                    <Label className="text-xs">Link to Campaign (optional)</Label>
                    <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                      <SelectTrigger className="bg-secondary/50 border-border/50 h-9 text-sm">
                        <SelectValue placeholder="No campaign" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No campaign</SelectItem>
                        {campaigns.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Logo / Favicon */}
                  <div className="space-y-2">
                    <Label className="text-xs">Logo / Favicon (optional)</Label>
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                    <div className="flex items-center gap-2">
                      {logoPreview ? (
                        <div className="relative">
                          <img src={logoPreview} alt="" className="h-9 w-9 rounded-lg object-cover border border-border/50" />
                          <button onClick={() => { setLogoFile(null); setLogoPreview(null); }} className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center text-[8px]">✕</button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="text-xs gap-1.5 h-9" onClick={() => logoInputRef.current?.click()}>
                          <ImagePlus className="h-3 w-3" />Upload Logo
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reference file */}
                <div className="space-y-2">
                  <Label className="text-xs">Reference File (optional)</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.html,.png,.jpg,.jpeg,.webp"
                      className="hidden"
                      id="lp-ref-file"
                      onChange={handleRefFileSelect}
                    />
                    <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => document.getElementById("lp-ref-file")?.click()}>
                      <Upload className="h-3 w-3" />Upload File
                    </Button>
                    {referenceFile && (
                      <Badge variant="secondary" className="text-xs gap-1.5">
                        <FileText className="h-3 w-3" />
                        {referenceFile.name}
                        <button onClick={() => { setReferenceFile(null); setReferenceContent(null); }} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                  </div>
                </div>

                {selectedCampaign && (
                  <div className="rounded-lg border border-primary/10 bg-primary/5 p-3 text-xs text-muted-foreground flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (selectedCampaign.brand_colors as any)?.primary || "#7c3aed" }} />
                    Brand: <strong>{selectedCampaign.name}</strong> · Real stock photos · Schema.org SEO
                  </div>
                )}

                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending || !topic.trim()}
                  className="gradient-primary text-primary-foreground hover:opacity-90 w-full"
                >
                  {generateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating… (15-30s)</> : <><Sparkles className="mr-2 h-4 w-4" />Generate Landing Page</>}
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Preview */}
        {previewHtml && (
          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-2 text-sm font-medium"><Eye className="h-4 w-4 text-primary" />Preview</span>
                <Button variant="ghost" size="sm" onClick={() => setPreviewHtml(null)}>Close</Button>
              </div>
              <iframe srcDoc={previewHtml} className="w-full h-[600px] rounded-xl border border-border/50 bg-white" sandbox="allow-scripts" title="Preview" />
            </CardContent>
          </Card>
        )}

        {/* Pages List */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !pages?.length ? (
          <Card className="border-dashed border-2 border-border/50">
            <CardContent className="py-20 text-center">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <Globe className="h-10 w-10 text-primary/40" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No landing pages yet</h3>
              <p className="text-sm text-muted-foreground mb-6">Generate your first SEO-optimized landing page with real stock photos above</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page) => {
              const linkedCampaign = campaigns.find(c => c.id === page.campaign_id);
              return (
                <Card key={page.id} className="group overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  <div className="relative h-44 bg-muted/5 border-b border-border/20 overflow-hidden">
                    {page.html_content ? (
                      <iframe srcDoc={page.html_content} className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none" sandbox="" title={page.title ?? ""} />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/5 to-secondary/10">
                        <Globe className="h-8 w-8 text-muted-foreground/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="default" size="sm" className="h-8 text-xs" onClick={() => setPreviewHtml(page.html_content ?? "")}>
                        <Eye className="h-3 w-3 mr-1" />Preview
                      </Button>
                      <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => setEditingPage(page)}>
                        <Pencil className="h-3 w-3 mr-1" />Edit
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm truncate">{page.title || "Untitled"}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(page.created_at), "MMM d, yyyy")}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant={page.is_public ? "default" : "secondary"} className="text-[10px]">{page.is_public ? "Public" : "Private"}</Badge>
                        <Switch checked={page.is_public} onCheckedChange={(checked) => toggleVisibilityMutation.mutate({ id: page.id, is_public: checked })} className="scale-75" />
                      </div>
                    </div>
                    {linkedCampaign && (
                      <Badge variant="outline" className="text-[10px] border-primary/20 text-primary mb-2">
                        <Megaphone className="h-2.5 w-2.5 mr-1" />{linkedCampaign.name}
                      </Badge>
                    )}
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => regenerateMutation.mutate(page)} disabled={regenerateMutation.isPending} title="Regenerate">
                        {regenerateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      </Button>
                      {page.slug && page.is_public && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(publicUrl(page.slug!), "_blank")}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-auto" onClick={() => deleteMutation.mutate(page.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
