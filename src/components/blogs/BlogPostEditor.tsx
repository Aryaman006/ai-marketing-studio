import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCampaign } from "@/contexts/CampaignContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Loader2, Sparkles, Save, ImagePlus, Search, X, ExternalLink, Megaphone,
  Eye, Bold, Italic, Heading1, Heading2, List, ListOrdered, Quote, Code, Link2, Minus,
} from "lucide-react";
import { toast } from "sonner";

const AI_STYLES = ["informative", "tutorial", "opinion", "listicle", "case-study", "storytelling"];

interface BlogPost {
  id: string; blog_site_id: string; user_id: string; title: string;
  content: string | null; hero_image_url: string | null; images: any;
  status: string; slug: string | null; created_at: string; updated_at: string;
}

interface StockImage {
  id: number; url: string; thumbnail: string; alt: string; photographer: string;
}

interface Props {
  site: { id: string; name: string };
  post: BlogPost | null;
  onBack: () => void;
  onSaved: () => void;
}

export function BlogPostEditor({ site, post, onBack, onSaved }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!post;
  const { campaigns } = useCampaign();

  const [title, setTitle] = useState(post?.title || "");
  const [content, setContent] = useState(post?.content || "");
  const [heroImage, setHeroImage] = useState(post?.hero_image_url || "");
  const [inlineImages, setInlineImages] = useState<string[]>(
    Array.isArray(post?.images) ? post.images : []
  );
  const [status, setStatus] = useState(post?.status || "draft");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [editorView, setEditorView] = useState<"write" | "preview">("write");

  const { data: existingLink } = useQuery({
    queryKey: ["campaign-blog-link", post?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_blog_posts")
        .select("campaign_id")
        .eq("blog_post_id", post!.id)
        .maybeSingle();
      return data?.campaign_id ?? null;
    },
    enabled: !!post?.id,
  });

  useEffect(() => {
    if (existingLink) setSelectedCampaignId(existingLink);
  }, [existingLink]);

  const [aiTopic, setAiTopic] = useState("");
  const [aiStyle, setAiStyle] = useState("informative");
  const [showImagePicker, setShowImagePicker] = useState<"hero" | "inline" | null>(null);
  const [imageQuery, setImageQuery] = useState("");
  const [stockImages, setStockImages] = useState<StockImage[]>([]);
  const [searchingImages, setSearchingImages] = useState(false);

  const searchStockImages = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setSearchingImages(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-stock-images", {
        body: { query: query.trim(), perPage: 12 },
      });
      if (error) throw error;
      setStockImages(data?.images || []);
    } catch { toast.error("Failed to search images"); }
    finally { setSearchingImages(false); }
  }, []);

  const selectStockImage = (img: StockImage) => {
    if (showImagePicker === "hero") setHeroImage(img.url);
    else setInlineImages((prev) => [...prev, img.url]);
    setShowImagePicker(null);
    setStockImages([]);
    setImageQuery("");
  };

  // Markdown toolbar helpers
  const insertMarkdown = (prefix: string, suffix = "") => {
    const textarea = document.getElementById("blog-content-editor") as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);
    const replacement = prefix + (selected || "text") + suffix;
    setContent(content.slice(0, start) + replacement + content.slice(end));
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + prefix.length;
      textarea.selectionEnd = start + prefix.length + (selected || "text").length;
    }, 0);
  };

  // AI generate
  const generateMutation = useMutation({
    mutationFn: async () => {
      const topic = aiTopic.trim() || title.trim();
      if (!topic) throw new Error("Provide a topic or title first");
      const { data, error } = await supabase.functions.invoke("generate-blog", {
        body: { topic, style: aiStyle },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const { data: credits } = await supabase.from("user_credits").select("credits_remaining").eq("user_id", user!.id).single();
      if (credits) {
        await supabase.from("user_credits").update({ credits_remaining: Math.max(0, credits.credits_remaining - 2) }).eq("user_id", user!.id);
      }
      return data.content as string;
    },
    onSuccess: (generatedContent) => {
      setContent(generatedContent);
      if (!title) {
        const match = generatedContent.match(/^#\s+(.+)/m);
        if (match) setTitle(match[1]);
      }
      toast.success("Blog content generated!");
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      if (!heroImage) {
        const topic = aiTopic.trim() || title.trim();
        if (topic) fetchDefaultHeroImage(topic);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const fetchDefaultHeroImage = async (topic: string) => {
    try {
      const { data } = await supabase.functions.invoke("search-stock-images", {
        body: { query: topic, perPage: 1 },
      });
      if (data?.images?.[0]) setHeroImage(data.images[0].url);
    } catch { /* silent */ }
  };

  const generateSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedTitle = title.trim() || "Untitled Post";
      let finalHero = heroImage;
      if (!finalHero && trimmedTitle !== "Untitled Post") {
        try {
          const { data } = await supabase.functions.invoke("search-stock-images", {
            body: { query: trimmedTitle, perPage: 1 },
          });
          if (data?.images?.[0]) finalHero = data.images[0].url;
        } catch { /* ok */ }
      }
      const payload = {
        title: trimmedTitle, content, hero_image_url: finalHero || null,
        images: inlineImages, status, slug: generateSlug(trimmedTitle),
      } as any;
      let postId = post?.id;
      if (isEditing) {
        const { error } = await supabase.from("blog_posts" as any).update(payload).eq("id", post!.id).eq("user_id", user!.id);
        if (error) throw error;
      } else {
        payload.blog_site_id = site.id;
        payload.user_id = user!.id;
        const { data: inserted, error } = await supabase.from("blog_posts" as any).insert(payload).select("id").single();
        if (error) throw error;
        postId = (inserted as any)?.id;
      }
      if (postId) {
        await supabase.from("campaign_blog_posts").delete().eq("blog_post_id", postId);
        if (selectedCampaignId) {
          await supabase.from("campaign_blog_posts").insert({ campaign_id: selectedCampaignId, blog_post_id: postId });
        }
      }
    },
    onSuccess: () => { toast.success(isEditing ? "Post updated!" : "Post created!"); onSaved(); },
    onError: (err: Error) => toast.error(err.message),
  });

  // Simple markdown preview renderer
  const renderPreview = (md: string) => {
    return md
      .replace(/^### (.+)/gm, '<h3 class="text-lg font-semibold text-foreground mt-5 mb-2">$1</h3>')
      .replace(/^## (.+)/gm, '<h2 class="text-xl font-bold text-foreground mt-6 mb-3">$1</h2>')
      .replace(/^# (.+)/gm, '<h1 class="text-2xl font-bold text-foreground mt-8 mb-4">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-secondary/50 px-1.5 py-0.5 rounded text-sm">$1</code>')
      .replace(/^> (.+)/gm, '<blockquote class="border-l-4 border-primary/30 pl-4 py-1 my-3 text-muted-foreground italic">$1</blockquote>')
      .replace(/^- (.+)/gm, '<li class="ml-5 list-disc mb-1">$1</li>')
      .replace(/^\d+\. (.+)/gm, '<li class="ml-5 list-decimal mb-1">$1</li>')
      .replace(/^---$/gm, '<hr class="my-6 border-border/50" />')
      .replace(/\n\n/g, '</p><p class="mb-3 leading-relaxed text-foreground/85">')
      .replace(/\n/g, '<br/>')
      ;
  };

  return (
    <>
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{isEditing ? "Edit Post" : "New Post"}</h1>
          <p className="text-xs text-muted-foreground">{site.name}</p>
          {isEditing && status === "published" && post?.slug && (
            <Link to={`/blog/${site.id}/${post.slug}`} target="_blank" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5">
              View published <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-28 bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gradient-primary text-primary-foreground hover:opacity-90">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main editor */}
        <div className="lg:col-span-2 space-y-4">
          {/* Hero Image */}
          <Card className="glass overflow-hidden">
            {heroImage ? (
              <div className="relative aspect-[2.5/1]">
                <img src={heroImage} alt="Hero" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                  <span className="text-white/70 text-xs">Hero image</span>
                  <div className="flex gap-1">
                    <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => { setShowImagePicker("hero"); setImageQuery(title || "blog"); }}>
                      <ImagePlus className="h-3 w-3 mr-1" />Change
                    </Button>
                    <Button variant="secondary" size="icon" className="h-7 w-7" onClick={() => setHeroImage("")}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="aspect-[2.5/1] flex flex-col items-center justify-center bg-gradient-to-br from-secondary/40 to-secondary/10 cursor-pointer hover:from-secondary/50 hover:to-secondary/20 transition-colors"
                onClick={() => { setShowImagePicker("hero"); setImageQuery(title || "blog"); }}
              >
                <ImagePlus className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">Add a hero image</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Click to browse stock photos or auto-fetched from Pexels</p>
              </div>
            )}
          </Card>

          {/* Title */}
          <Input
            placeholder="Your blog post title…"
            value={title} onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-bold bg-secondary/30 border-border/30 h-14 px-4"
          />

          {/* Content editor with toolbar */}
          <Card className="glass overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 p-2 border-b border-border/30 bg-secondary/20 flex-wrap">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown("**", "**")} title="Bold"><Bold className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown("*", "*")} title="Italic"><Italic className="h-3.5 w-3.5" /></Button>
              <div className="w-px h-5 bg-border/30 mx-1" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown("# ", "")} title="Heading 1"><Heading1 className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown("## ", "")} title="Heading 2"><Heading2 className="h-3.5 w-3.5" /></Button>
              <div className="w-px h-5 bg-border/30 mx-1" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown("- ", "")} title="Bullet list"><List className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown("1. ", "")} title="Numbered list"><ListOrdered className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown("> ", "")} title="Quote"><Quote className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown("`", "`")} title="Code"><Code className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown("[", "](url)")} title="Link"><Link2 className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown("\n---\n", "")} title="Divider"><Minus className="h-3.5 w-3.5" /></Button>
              <div className="flex-1" />
              <div className="flex gap-0.5 bg-secondary/30 rounded-md p-0.5">
                <Button variant={editorView === "write" ? "default" : "ghost"} size="sm" className="h-6 text-[10px] px-2" onClick={() => setEditorView("write")}>Write</Button>
                <Button variant={editorView === "preview" ? "default" : "ghost"} size="sm" className="h-6 text-[10px] px-2" onClick={() => setEditorView("preview")}>
                  <Eye className="h-3 w-3 mr-1" />Preview
                </Button>
              </div>
            </div>

            {editorView === "write" ? (
              <Textarea
                id="blog-content-editor"
                placeholder="Write your blog content here (Markdown supported)…"
                value={content} onChange={(e) => setContent(e.target.value)}
                rows={20}
                className="border-0 rounded-none bg-transparent font-mono text-sm leading-relaxed resize-none focus-visible:ring-0"
              />
            ) : (
              <div
                className="p-6 min-h-[400px] prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: `<p class="mb-3 leading-relaxed text-foreground/85">${renderPreview(content)}</p>` }}
              />
            )}
          </Card>

          {/* Inline images */}
          {inlineImages.length > 0 && (
            <Card className="glass">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Inline Images</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {inlineImages.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border/50 group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <Button variant="secondary" size="icon" className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setInlineImages((prev) => prev.filter((_, j) => j !== i))}>
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Button variant="outline" size="sm" onClick={() => { setShowImagePicker("inline"); setImageQuery(title || "blog"); }}>
            <ImagePlus className="mr-2 h-3.5 w-3.5" />Add Inline Image
          </Button>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {campaigns.length > 0 && (
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Megaphone className="h-4 w-4 text-primary" />Campaign
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedCampaignId ?? "none"} onValueChange={(v) => setSelectedCampaignId(v === "none" ? null : v)}>
                  <SelectTrigger className="bg-secondary/50 border-border/50 h-9 text-sm"><SelectValue placeholder="No campaign" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No campaign</SelectItem>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded text-[8px] font-bold text-white flex items-center justify-center shrink-0"
                            style={{ background: (c.brand_colors as any)?.primary || "hsl(var(--primary))" }}>
                            {c.name.charAt(0)}
                          </div>
                          <span className="truncate">{c.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">Brand colors will be applied to the public blog theme.</p>
              </CardContent>
            </Card>
          )}

          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />AI Generate
                <Badge variant="secondary" className="ml-auto text-xs">2 credits</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Topic</Label>
                <Input placeholder="e.g. AI in marketing" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} className="bg-secondary/50 border-border/50 h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Style</Label>
                <Select value={aiStyle} onValueChange={setAiStyle}>
                  <SelectTrigger className="bg-secondary/50 border-border/50 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AI_STYLES.map((s) => <SelectItem key={s} value={s} className="capitalize text-sm">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="w-full gradient-primary text-primary-foreground hover:opacity-90" size="sm">
                {generateMutation.isPending ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Generating…</> : <><Sparkles className="mr-2 h-3.5 w-3.5" />Generate Content</>}
              </Button>
            </CardContent>
          </Card>

          {/* Stats */}
          {content && (
            <Card className="glass">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-foreground">{content.split(/\s+/).length}</p>
                    <p className="text-[10px] text-muted-foreground">Words</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{Math.max(1, Math.round(content.split(/\s+/).length / 200))}</p>
                    <p className="text-[10px] text-muted-foreground">Min read</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Stock Image Picker */}
      <Dialog open={!!showImagePicker} onOpenChange={(o) => !o && setShowImagePicker(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Select Stock Image</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Search Pexels for photos…" value={imageQuery} onChange={(e) => setImageQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchStockImages(imageQuery)} className="bg-secondary/50 border-border/50" />
              <Button onClick={() => searchStockImages(imageQuery)} disabled={searchingImages}>
                {searchingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {stockImages.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                {stockImages.map((img) => (
                  <div key={img.id} className="cursor-pointer rounded-lg overflow-hidden border border-border/50 hover:border-primary hover:shadow-md transition-all group"
                    onClick={() => selectStockImage(img)}>
                    <img src={img.thumbnail} alt={img.alt} className="w-full aspect-video object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                    <p className="text-[10px] text-muted-foreground px-2 py-1.5 truncate">📷 {img.photographer}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">Search for free stock images from Pexels</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
