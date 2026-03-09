import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Campaign } from "@/contexts/CampaignContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Image, Loader2, Trash2, Download, Sparkles, Pencil, ChevronDown, ImagePlus, Search, FileCode } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import AssetEditor from "./AssetEditor";

const ASSET_TYPES = [
  { value: "ad_banner", label: "Ad Banner", icon: "📢" },
  { value: "social_media", label: "Social Post", icon: "📱" },
  { value: "hero_image", label: "Hero Image", icon: "🖼️" },
  { value: "logo", label: "Logo", icon: "✦" },
  { value: "icon", label: "Icon", icon: "◆" },
  { value: "story", label: "Story", icon: "📲" },
  { value: "thumbnail", label: "Thumbnail", icon: "🎬" },
];

interface AssetGeneration {
  id: string;
  title: string | null;
  input: {
    prompt?: string; assetType?: string; imageUrl?: string;
    storagePath?: string; svgContent?: string; format?: string;
  } | null;
  output: string | null;
  created_at: string;
}

interface StockImage {
  id: number; url: string; thumbnail: string; alt: string; photographer: string;
}

export default function CampaignAssets({ campaign }: { campaign: Campaign }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [assetType, setAssetType] = useState("ad_banner");
  const [generatorOpen, setGeneratorOpen] = useState(true);
  const [genMode, setGenMode] = useState<"ai" | "stock">("ai");
  const [stockQuery, setStockQuery] = useState("");
  const [stockResults, setStockResults] = useState<StockImage[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  // Editor state
  const [editorAsset, setEditorAsset] = useState<AssetGeneration | null>(null);

  const brandPayload = {
    name: campaign.name,
    type: campaign.brand_type,
    tone: campaign.brand_tone,
    primaryColor: (campaign.brand_colors as any)?.primary,
    secondaryColor: (campaign.brand_colors as any)?.secondary,
    audience: campaign.target_audience,
  };

  const { data: assets, isLoading } = useQuery({
    queryKey: ["assets", user?.id, campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generations").select("*")
        .eq("user_id", user!.id).eq("type", "asset")
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as AssetGeneration[];
    },
    enabled: !!user,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const trimmed = prompt.trim();
      if (!trimmed) throw new Error("Describe what you want to create");

      const { data: fnData, error: fnError } = await supabase.functions.invoke("generate-asset", {
        body: {
          prompt: trimmed,
          assetType,
          brand: brandPayload,
        },
      });
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      await supabase.from("generations").insert({
        user_id: user!.id, type: "asset", title: trimmed,
        input: {
          prompt: trimmed, assetType,
          imageUrl: fnData.imageUrl, storagePath: fnData.storagePath,
          svgContent: fnData.svgContent || null, format: fnData.format || "svg",
        },
        output: fnData.imageUrl, campaign_id: campaign.id,
      });

      // Deduct credits server-side
      const { data: creditData, error: creditError } = await supabase.functions.invoke("deduct-credits", {
        body: { amount: 1 },
      });
      if (creditError || creditData?.error) {
        console.warn("Credit deduction failed:", creditData?.error || creditError);
      }
      return fnData;
    },
    onSuccess: () => {
      toast.success("Asset created!");
      setPrompt("");
      setGeneratorOpen(false);
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const searchStock = async () => {
    if (!stockQuery.trim()) return;
    setStockLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-asset", {
        body: { stockQuery: stockQuery.trim() },
      });
      if (error) throw error;
      setStockResults(data?.images || []);
    } catch {
      toast.error("Failed to search stock images");
    } finally {
      setStockLoading(false);
    }
  };

  const saveStockImage = async (img: StockImage) => {
    await supabase.from("generations").insert({
      user_id: user!.id, type: "asset", title: img.alt || stockQuery,
      input: { prompt: stockQuery, assetType: "stock", imageUrl: img.url, format: "stock" },
      output: img.url, campaign_id: campaign.id,
    });
    toast.success("Stock image saved!");
    queryClient.invalidateQueries({ queryKey: ["assets"] });
  };

  const editMutation = useMutation({
    mutationFn: async (instruction: string) => {
      if (!editorAsset) throw new Error("No asset selected");
      const existingImageUrl = (editorAsset.input as any)?.imageUrl || editorAsset.output;

      const { data: fnData, error: fnError } = await supabase.functions.invoke("generate-asset", {
        body: {
          prompt: editorAsset.title || "marketing asset",
          assetType: (editorAsset.input as any)?.assetType || "ad_banner",
          editInstruction: instruction,
          existingImageUrl,
          brand: brandPayload,
        },
      });
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      await supabase.from("generations").insert({
        user_id: user!.id, type: "asset", title: `${editorAsset.title} (edited)`,
        input: {
          prompt: editorAsset.title, assetType: (editorAsset.input as any)?.assetType,
          imageUrl: fnData.imageUrl, storagePath: fnData.storagePath,
          editedFrom: editorAsset.id, format: fnData.format,
        },
        output: fnData.imageUrl, campaign_id: campaign.id,
      });

      const { data: creditData, error: creditError } = await supabase.functions.invoke("deduct-credits", {
        body: { amount: 1 },
      });
      if (creditError || creditData?.error) {
        console.warn("Credit deduction failed:", creditData?.error || creditError);
      }
    },
    onSuccess: () => {
      toast.success("Asset regenerated!");
      setEditorAsset(null);
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (asset: AssetGeneration) => {
      const storagePath = (asset.input as any)?.storagePath;
      if (storagePath) await supabase.storage.from("assets").remove([storagePath]);
      const { error } = await supabase.from("generations").delete().eq("id", asset.id).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Asset deleted");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });

  const downloadImage = async (url: string, title: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const ext = url.endsWith(".svg") ? "svg" : "png";
      a.download = `${title || "asset"}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast.error("Failed to download"); }
  };

  const getTypeLabel = (type: string) => ASSET_TYPES.find((t) => t.value === type)?.label ?? type;

  return (
    <div className="space-y-4">
      {/* Generator */}
      <Collapsible open={generatorOpen} onOpenChange={setGeneratorOpen}>
        <Card className="glass">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-secondary/20 transition-colors rounded-t-xl">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-base">
                  <ImagePlus className="h-4 w-4 text-primary" />Create Asset
                  <Badge variant="secondary" className="text-[10px] ml-1">1 credit</Badge>
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${generatorOpen ? "rotate-180" : ""}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <Tabs value={genMode} onValueChange={(v) => setGenMode(v as any)}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="ai" className="text-xs">
                    <FileCode className="h-3 w-3 mr-1" />AI Design
                  </TabsTrigger>
                  <TabsTrigger value="stock" className="text-xs">
                    <Search className="h-3 w-3 mr-1" />Stock Photo
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="ai" className="space-y-3 mt-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Describe your creative</Label>
                      <Textarea
                        placeholder="e.g. A bold SaaS launch banner with gradient background, headline 'Get Started Free', and a prominent CTA button"
                        value={prompt} onChange={(e) => setPrompt(e.target.value)}
                        maxLength={1500} rows={2} className="bg-secondary/30 border-border/30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type</Label>
                      <Select value={assetType} onValueChange={setAssetType}>
                        <SelectTrigger className="bg-secondary/30 border-border/30 w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ASSET_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              <span className="mr-1.5">{t.icon}</span>{t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="rounded-lg border border-primary/10 bg-primary/5 p-2.5 text-xs text-muted-foreground flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (campaign.brand_colors as any)?.primary || "#7c3aed" }} />
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (campaign.brand_colors as any)?.secondary || "#a78bfa" }} />
                    <span>Brand: <strong>{campaign.name}</strong> · {campaign.brand_tone} · {campaign.brand_type}</span>
                  </div>
                  <div className="rounded-lg border border-accent/20 bg-accent/5 p-2.5 text-xs text-muted-foreground">
                    ✨ Generates editable SVG graphics — change text, colors, and shapes after creation
                  </div>
                  <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending || !prompt.trim()} className="gradient-primary text-primary-foreground hover:opacity-90">
                    {generateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</> : <><Sparkles className="mr-2 h-4 w-4" />Generate SVG Asset</>}
                  </Button>
                </TabsContent>

                <TabsContent value="stock" className="space-y-3 mt-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search Pexels for stock photos…"
                      value={stockQuery} onChange={(e) => setStockQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && searchStock()}
                      className="bg-secondary/30 border-border/30"
                    />
                    <Button variant="secondary" onClick={searchStock} disabled={stockLoading || !stockQuery.trim()}>
                      {stockLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  {stockResults.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
                      {stockResults.map((img) => (
                        <div key={img.id} className="relative group rounded-md overflow-hidden border border-border/30 cursor-pointer" onClick={() => saveStockImage(img)}>
                          <img src={img.thumbnail} alt={img.alt} className="w-full aspect-video object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-[10px] font-medium text-primary">+ Save</span>
                          </div>
                          <span className="absolute bottom-0 left-0 right-0 bg-background/80 text-[9px] text-muted-foreground px-1 py-0.5 truncate">
                            📷 {img.photographer}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Gallery */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !assets?.length ? (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <Image className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No assets yet. Create your first marketing graphic above!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => {
            const isSvgAsset = (asset.input as any)?.format === "svg";
            return (
              <Card key={asset.id} className="glass group overflow-hidden hover:shadow-glow transition-all hover:-translate-y-0.5">
                <div className="relative aspect-video bg-muted/10">
                  {asset.output ? (
                    <img src={asset.output} alt={asset.title || "Asset"} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Image className="h-8 w-8 text-muted-foreground/30" /></div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => setEditorAsset(asset)}>
                      <Pencil className="h-3 w-3 mr-1" />Edit
                    </Button>
                    <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => downloadImage(asset.output!, asset.title || "asset")}>
                      <Download className="h-3 w-3 mr-1" />Save
                    </Button>
                    <Button variant="secondary" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(asset)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {isSvgAsset && (
                    <Badge className="absolute top-2 right-2 text-[9px] bg-accent/80">SVG</Badge>
                  )}
                </div>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                      {getTypeLabel((asset.input as any)?.assetType ?? "")}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(asset.created_at), "MMM d")}</span>
                  </div>
                  <p className="text-sm truncate">{asset.title || "Untitled"}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Asset Editor Dialog */}
      {editorAsset && (
        <AssetEditor
          open={!!editorAsset}
          onClose={() => setEditorAsset(null)}
          imageUrl={editorAsset.output || ""}
          svgContent={(editorAsset.input as any)?.svgContent || null}
          title={editorAsset.title || "Untitled"}
          onRegenerate={async (instruction) => { await editMutation.mutateAsync(instruction); }}
          isRegenerating={editMutation.isPending}
        />
      )}
    </div>
  );
}
