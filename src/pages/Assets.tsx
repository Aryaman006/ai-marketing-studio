import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCampaign } from "@/contexts/CampaignContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Image, Loader2, Trash2, Download, Sparkles, Pencil, RefreshCw, Megaphone, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const ASSET_TYPES = [
  { value: "ad_banner", label: "Ad Banner" },
  { value: "social_media", label: "Social Media" },
  { value: "logo", label: "Logo" },
  { value: "icon", label: "Icon" },
  { value: "story", label: "Story" },
  { value: "thumbnail", label: "Thumbnail" },
];

interface AssetGeneration {
  id: string; title: string | null;
  input: { prompt?: string; assetType?: string; imageUrl?: string; storagePath?: string } | null;
  output: string | null; created_at: string; campaign_id?: string | null;
}

export default function Assets() {
  const { user } = useAuth();
  const { activeCampaign } = useCampaign();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [assetType, setAssetType] = useState("ad_banner");
  const [generatorOpen, setGeneratorOpen] = useState(true);
  const [editingAsset, setEditingAsset] = useState<AssetGeneration | null>(null);
  const [editInstruction, setEditInstruction] = useState("");

  const { data: assets, isLoading } = useQuery({
    queryKey: ["assets", user?.id, activeCampaign?.id],
    queryFn: async () => {
      let query = supabase.from("generations").select("*").eq("user_id", user!.id).eq("type", "asset").order("created_at", { ascending: false });
      if (activeCampaign) query = query.eq("campaign_id", activeCampaign.id);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as AssetGeneration[];
    },
    enabled: !!user,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const trimmed = prompt.trim();
      if (!trimmed) throw new Error("Prompt is required");

      const brandPrompt = activeCampaign
        ? ` Brand: ${activeCampaign.name}, style: ${activeCampaign.brand_type}, tone: ${activeCampaign.brand_tone}. Colors: ${(activeCampaign.brand_colors as any)?.primary} and ${(activeCampaign.brand_colors as any)?.secondary}.`
        : "";

      const { data: fnData, error: fnError } = await supabase.functions.invoke("generate-asset", {
        body: { prompt: trimmed + brandPrompt, assetType },
      });
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      await supabase.from("generations").insert({
        user_id: user!.id, type: "asset", title: trimmed,
        input: { prompt: trimmed, assetType, imageUrl: fnData.imageUrl, storagePath: fnData.storagePath },
        output: fnData.imageUrl, campaign_id: activeCampaign?.id || null,
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
      toast.success("Image generated!");
      setPrompt("");
      setGeneratorOpen(false);
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to generate"),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingAsset || !editInstruction.trim()) throw new Error("Edit instruction required");
      const existingImageUrl = (editingAsset.input as any)?.imageUrl || editingAsset.output;

      const { data: fnData, error: fnError } = await supabase.functions.invoke("generate-asset", {
        body: {
          prompt: editingAsset.title || "marketing asset",
          assetType: (editingAsset.input as any)?.assetType || "ad_banner",
          editInstruction: editInstruction.trim(), existingImageUrl,
        },
      });
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      await supabase.from("generations").insert({
        user_id: user!.id, type: "asset", title: `${editingAsset.title} (edited)`,
        input: { prompt: editingAsset.title, assetType: (editingAsset.input as any)?.assetType, imageUrl: fnData.imageUrl, storagePath: fnData.storagePath, editedFrom: editingAsset.id },
        output: fnData.imageUrl, campaign_id: activeCampaign?.id || null,
      });

      // Deduct credits server-side
      const { data: creditData2, error: creditError2 } = await supabase.functions.invoke("deduct-credits", {
        body: { amount: 1 },
      });
      if (creditError2 || creditData2?.error) {
        console.warn("Credit deduction failed:", creditData2?.error || creditError2);
      }
    },
    onSuccess: () => {
      toast.success("Image edited!");
      setEditingAsset(null); setEditInstruction("");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to edit"),
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
    onError: () => toast.error("Failed to delete"),
  });

  const downloadImage = async (url: string, title: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${title || "asset"}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast.error("Failed to download"); }
  };

  const getTypeLabel = (type: string) => ASSET_TYPES.find((t) => t.value === type)?.label ?? type;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
            {activeCampaign && (
              <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                <Megaphone className="mr-1 h-3 w-3" />{activeCampaign.name}
              </Badge>
            )}
          </div>
          <Badge variant="secondary" className="text-xs">{assets?.length ?? 0} assets</Badge>
        </div>

        {/* Collapsible Generator */}
        <Collapsible open={generatorOpen} onOpenChange={setGeneratorOpen}>
          <Card className="glass">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-secondary/20 transition-colors rounded-t-xl">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Generate Image
                    <Badge variant="secondary" className="text-[10px] ml-1">1 credit</Badge>
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${generatorOpen ? "rotate-180" : ""}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-2">
                    <Label className="text-xs">Describe your image</Label>
                    <Textarea placeholder="e.g. A modern SaaS banner with gradient background" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={1000} rows={2} className="bg-secondary/50 border-border/50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Type</Label>
                    <Select value={assetType} onValueChange={setAssetType}>
                      <SelectTrigger className="bg-secondary/50 border-border/50 w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ASSET_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {activeCampaign && (
                  <div className="rounded-lg border border-primary/10 bg-primary/5 p-3 text-xs text-muted-foreground">
                    Brand settings from <strong>{activeCampaign.name}</strong> will be applied
                  </div>
                )}
                <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending || !prompt.trim()} className="gradient-primary text-primary-foreground hover:opacity-90">
                  {generateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</> : <><Sparkles className="mr-2 h-4 w-4" />Generate</>}
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Assets Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !assets?.length ? (
          <Card className="glass border-dashed">
            <CardContent className="py-12 text-center">
              <Image className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No assets yet. Generate your first image above!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <Card key={asset.id} className="glass group overflow-hidden hover:shadow-glow transition-shadow">
                <div className="relative aspect-video bg-muted/20">
                  {asset.output ? (
                    <img src={asset.output} alt={asset.title || "Asset"} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Image className="h-8 w-8 text-muted-foreground/30" /></div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => { setEditingAsset(asset); setEditInstruction(""); }} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => downloadImage(asset.output!, asset.title || "asset")} title="Download">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(asset)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">{getTypeLabel((asset.input as any)?.assetType ?? "")}</Badge>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(asset.created_at), "MMM d")}</span>
                  </div>
                  <p className="text-sm truncate">{asset.title || "Untitled"}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingAsset} onOpenChange={(o) => !o && setEditingAsset(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base"><RefreshCw className="h-4 w-4 text-primary" />Edit with AI</DialogTitle>
            </DialogHeader>
            {editingAsset && (
              <div className="space-y-4">
                <div className="rounded-lg overflow-hidden border border-border/50 bg-muted/20">
                  <img src={editingAsset.output || ""} alt="Current" className="w-full max-h-56 object-contain" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">What would you like to change?</Label>
                  <Textarea placeholder="e.g. Change the background to dark blue" value={editInstruction} onChange={(e) => setEditInstruction(e.target.value)} rows={2} className="bg-secondary/50 border-border/50" />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingAsset(null)}>Cancel</Button>
              <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending || !editInstruction.trim()} className="gradient-primary text-primary-foreground">
                {editMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Editing…</> : <><Pencil className="h-4 w-4 mr-2" />Apply</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
