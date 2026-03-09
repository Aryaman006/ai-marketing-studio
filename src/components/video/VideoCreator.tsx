import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Campaign } from "@/contexts/CampaignContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Video, Loader2, Sparkles, ChevronDown, Search, X, RefreshCw, Upload, Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import VideoRenderer, { SceneData, VideoRendererHandle } from "./VideoRenderer";

const CTA_OPTIONS = ["Shop Now", "Learn More", "Visit Website", "Order Now", "Get Started", "Sign Up Free", "Book Now", "Download"];

interface StockImage {
  id: number; url: string; thumbnail: string; alt: string; photographer: string;
}

interface VideoRow {
  id: string;
  title: string;
  description: string | null;
  scene_data: SceneData | null;
  video_url: string | null;
  thumbnail_url: string | null;
  status: string;
  created_at: string;
  campaign_id?: string | null;
}

interface Props {
  campaign?: Campaign | null;
  editingVideo?: VideoRow | null;
  onCreated?: () => void;
  onCancelEdit?: () => void;
}

export default function VideoCreator({ campaign, editingVideo, onCreated, onCancelEdit }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const rendererRef = useRef<VideoRendererHandle>(null);

  const [open, setOpen] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [ctaText, setCtaText] = useState("Shop Now");
  const [imageUrl, setImageUrl] = useState("");
  const [stockQuery, setStockQuery] = useState("");
  const [stockResults, setStockResults] = useState<StockImage[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [previewScene, setPreviewScene] = useState<SceneData | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Load editing video data
  useEffect(() => {
    if (editingVideo) {
      setOpen(true);
      setPrompt(editingVideo.description || editingVideo.title || "");
      if (editingVideo.scene_data) {
        setPreviewScene(editingVideo.scene_data);
      }
    }
  }, [editingVideo]);

  const brandPayload = campaign ? {
    name: campaign.name,
    type: campaign.brand_type,
    tone: campaign.brand_tone,
    primaryColor: (campaign.brand_colors as any)?.primary,
    secondaryColor: (campaign.brand_colors as any)?.secondary,
    audience: campaign.target_audience,
    logoUrl: campaign.logo_url,
  } : {};

  const searchStock = async () => {
    if (!stockQuery.trim()) return;
    setStockLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-video", {
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

  const toggleStockImage = (url: string) => {
    setSelectedImages((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : prev.length < 5 ? [...prev, url] : prev
    );
  };

  const addImageUrl = () => {
    const url = imageUrl.trim();
    if (!url) return;
    if (selectedImages.length >= 5) { toast.error("Max 5 images"); return; }
    if (selectedImages.includes(url)) { toast.error("Already added"); return; }
    setSelectedImages(prev => [...prev, url]);
    setImageUrl("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;
    const remaining = 5 - selectedImages.length;
    if (remaining <= 0) { toast.error("Max 5 images"); return; }
    const filesToUpload = Array.from(files).slice(0, remaining);
    
    for (const file of filesToUpload) {
      if (!file.type.startsWith("image/")) { toast.error(`${file.name} is not an image`); continue; }
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5MB`); continue; }
      try {
        const fileName = `${user.id}/video-assets/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
        const { error: upErr } = await supabase.storage.from("assets").upload(fileName, file, {
          contentType: file.type, upsert: false,
        });
        if (upErr) throw upErr;
        const { data: pubUrl } = supabase.storage.from("assets").getPublicUrl(fileName);
        setSelectedImages(prev => [...prev, pubUrl.publicUrl]);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    e.target.value = "";
  };

  const removeImage = (url: string) => {
    setSelectedImages(prev => prev.filter(u => u !== url));
  };

  const [regenPrompt, setRegenPrompt] = useState("");
  const [savedVideoId, setSavedVideoId] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: async (regenInstructions?: string) => {
      let finalPrompt = prompt.trim();
      if (!finalPrompt) throw new Error("Describe your video concept");
      if (ctaText) finalPrompt += `\nCTA button text: "${ctaText}"`;
      if (regenInstructions) finalPrompt += `\n\nREGENERATION INSTRUCTIONS: ${regenInstructions}`;

      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: {
          prompt: finalPrompt,
          brand: brandPayload,
          imageUrls: selectedImages.length ? selectedImages : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.sceneData) throw new Error("No scene data returned");
      return data.sceneData as SceneData;
    },
    onSuccess: async (sceneData) => {
      setPreviewScene(sceneData);
      setRegenPrompt("");
      // Auto-save to database
      try {
        if (editingVideo || savedVideoId) {
          const videoId = editingVideo?.id || savedVideoId;
          await supabase.from("videos" as any).update({
            title: sceneData.title || prompt.slice(0, 100),
            description: prompt,
            scene_data: sceneData as any,
            status: "completed",
          } as any).eq("id", videoId);
          toast.success("Video updated & saved!");
        } else {
          const { data: inserted, error } = await supabase.from("videos" as any).insert({
            user_id: user!.id,
            campaign_id: campaign?.id || null,
            title: sceneData.title || prompt.slice(0, 100),
            description: prompt,
            scene_data: sceneData as any,
            status: "completed",
          } as any).select("id").single();
          if (!error && inserted) {
            setSavedVideoId((inserted as any).id);
          }
          await supabase.functions.invoke("deduct-credits", { body: { amount: 2 } });
          queryClient.invalidateQueries({ queryKey: ["credits"] });
          toast.success("Video generated & saved!");
        }
        queryClient.invalidateQueries({ queryKey: ["videos"] });
      } catch (e) {
        console.warn("Auto-save failed:", e);
        toast.success("Video generated! Click Save to keep it.");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveVideo = async () => {
    if (!previewScene || !user) return;
    setIsExporting(true);
    try {
      let videoUrl: string | null = null;
      try {
        const blob = await rendererRef.current?.exportVideo();
        if (blob) {
          const fileName = `${user.id}/${crypto.randomUUID()}.webm`;
          const { error: upErr } = await supabase.storage.from("assets").upload(fileName, blob, {
            contentType: "video/webm", upsert: false,
          });
          if (!upErr) {
            const { data: pubUrl } = supabase.storage.from("assets").getPublicUrl(fileName);
            videoUrl = pubUrl.publicUrl;
          }
        }
      } catch (e) {
        console.warn("Video export failed:", e);
      }

      if (videoUrl) {
        const videoId = editingVideo?.id || savedVideoId;
        if (videoId) {
          await supabase.from("videos" as any).update({ video_url: videoUrl } as any).eq("id", videoId);
        }
        // Trigger download
        const a = document.createElement("a");
        a.href = videoUrl;
        a.download = `${previewScene.title || "video"}.webm`;
        a.click();
        toast.success("Video exported!");
      } else {
        toast.error("Export failed — video is still saved as a scene.");
      }

      queryClient.invalidateQueries({ queryKey: ["videos"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to export video");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDiscard = () => {
    setPreviewScene(null);
    if (editingVideo) {
      setPrompt("");
      onCancelEdit?.();
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="glass">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-secondary/20 transition-colors rounded-t-xl">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-base">
                <Video className="h-4 w-4 text-primary" />
                {editingVideo ? "Edit Video" : "Create Video"}
                {!editingVideo && <Badge variant="secondary" className="text-[10px] ml-1">2 credits</Badge>}
              </span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {!previewScene ? (
              <>
                {/* Prompt */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Describe your video</Label>
                  <Textarea
                    placeholder='e.g. "Fashion sale reel for Eid collection with bold text and golden accents"'
                    value={prompt} onChange={(e) => setPrompt(e.target.value)}
                    maxLength={1500} rows={3} className="bg-secondary/30 border-border/30"
                  />
                </div>

                {/* Stock Image Search + URL — unified */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Add Images <span className="text-muted-foreground font-normal">(optional — search Pexels or paste URL)</span></Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search Pexels…"
                      value={stockQuery} onChange={(e) => setStockQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && searchStock()}
                      className="bg-secondary/30 border-border/30 flex-1"
                    />
                    <Button variant="secondary" size="sm" onClick={searchStock} disabled={stockLoading || !stockQuery.trim()}>
                      {stockLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>

                  {stockResults.length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-[180px] overflow-y-auto rounded-md border border-border/20 p-1.5">
                      {stockResults.map((img) => (
                        <div
                          key={img.id}
                          className={`relative rounded overflow-hidden cursor-pointer transition-all ${
                            selectedImages.includes(img.url)
                              ? "ring-2 ring-primary"
                              : "hover:ring-1 hover:ring-primary/40"
                          }`}
                          onClick={() => toggleStockImage(img.url)}
                        >
                          <img src={img.thumbnail} alt={img.alt} className="w-full aspect-video object-cover" loading="lazy" />
                          {selectedImages.includes(img.url) && (
                            <div className="absolute top-0.5 right-0.5 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">✓</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload or Paste URL */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Or paste image URL…"
                      value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addImageUrl()}
                      className="bg-secondary/30 border-border/30 flex-1 text-xs"
                    />
                    <Button variant="outline" size="sm" onClick={addImageUrl} disabled={!imageUrl.trim()}>Add</Button>
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
                      <Button variant="secondary" size="sm" asChild>
                        <span><Upload className="h-3.5 w-3.5 mr-1" />Upload</span>
                      </Button>
                    </label>
                  </div>

                  {/* Selected images strip */}
                  {selectedImages.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {selectedImages.map((url, i) => (
                        <div key={i} className="relative w-14 h-10 rounded overflow-hidden border border-primary/30 group">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => removeImage(url)}
                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                      <span className="text-[10px] text-muted-foreground self-end">{selectedImages.length}/5</span>
                    </div>
                  )}
                </div>

                {/* CTA */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">CTA Text</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {CTA_OPTIONS.map((cta) => (
                      <Badge key={cta} variant={ctaText === cta ? "default" : "outline"} className="cursor-pointer text-[10px]" onClick={() => setCtaText(cta)}>
                        {cta}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Brand */}
                {campaign && (
                  <div className="rounded-lg border border-primary/10 bg-primary/5 p-2.5 text-xs text-muted-foreground flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (campaign.brand_colors as any)?.primary || "#7c3aed" }} />
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (campaign.brand_colors as any)?.secondary || "#a78bfa" }} />
                    <span>Brand: <strong>{campaign.name}</strong> · {campaign.brand_tone} · {campaign.brand_type}</span>
                  </div>
                )}

                <Button
                  onClick={() => generateMutation.mutate(undefined)}
                  disabled={generateMutation.isPending || !prompt.trim()}
                  className="gradient-primary text-primary-foreground hover:opacity-90 w-full"
                >
                  {generateMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating Video…</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" />{editingVideo ? "Regenerate Video" : "Generate Motion Graphic"}</>
                  )}
                </Button>

                {editingVideo && (
                  <Button variant="outline" className="w-full" onClick={handleDiscard}>
                    Cancel Editing
                  </Button>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="max-w-sm mx-auto">
                  <VideoRenderer ref={rendererRef} sceneData={previewScene} autoPlay />
                </div>

                {/* Regeneration prompt */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Want changes? Describe what to adjust</Label>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder='e.g. "Make the text bigger, use warmer colors, add more bounce animations"'
                      value={regenPrompt} onChange={(e) => setRegenPrompt(e.target.value)}
                      rows={2} className="bg-secondary/30 border-border/30 flex-1 text-xs"
                    />
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    onClick={() => generateMutation.mutate(regenPrompt || undefined)}
                    disabled={generateMutation.isPending}
                    className="flex-1"
                  >
                    {generateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Regenerating…</> : <><RefreshCw className="h-3.5 w-3.5 mr-1" />Regenerate</>}
                  </Button>
                  <Button onClick={saveVideo} disabled={isExporting} className="gradient-primary text-primary-foreground">
                    {isExporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Exporting…</> : "📥 Export .webm"}
                  </Button>
                  <Button variant="outline" onClick={handleDiscard}>✕ Discard</Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">✅ Video auto-saved. Use Export to download as .webm file.</p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
