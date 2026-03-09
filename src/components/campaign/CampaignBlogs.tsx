import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Campaign } from "@/contexts/CampaignContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  BookOpen, Loader2, ExternalLink, Trash2, Plus, Sparkles, Eye,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface BlogPostLink {
  id: string; blog_post_id: string; campaign_id: string; created_at: string;
  blog_post?: {
    id: string; title: string; status: string; slug: string | null;
    blog_site_id: string; created_at: string; hero_image_url: string | null;
    content: string | null;
  };
}

export default function CampaignBlogs({ campaign }: { campaign: Campaign }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostTopic, setNewPostTopic] = useState("");
  const [aiStyle, setAiStyle] = useState("informative");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const { data: links, isLoading } = useQuery({
    queryKey: ["campaign-blog-posts", campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_blog_posts")
        .select("*, blog_posts(*)")
        .eq("campaign_id", campaign.id);
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d, blog_post: d.blog_posts,
      })) as BlogPostLink[];
    },
    enabled: !!user,
  });

  const { data: blogSites } = useQuery({
    queryKey: ["blog-sites", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_sites" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const createPostMutation = useMutation({
    mutationFn: async () => {
      const title = newPostTitle.trim();
      if (!title) throw new Error("Title is required");
      let siteId = selectedSiteId;

      if (!siteId) {
        if (blogSites && blogSites.length > 0) {
          siteId = blogSites[0].id;
        } else {
          const { data: newSite, error: siteError } = await supabase
            .from("blog_sites" as any)
            .insert({ user_id: user!.id, name: `${campaign.name} Blog` } as any)
            .select("id")
            .single();
          if (siteError) throw siteError;
          siteId = (newSite as any).id;
        }
      }

      let content = "";
      const topic = newPostTopic.trim() || title;
      try {
        const { data, error } = await supabase.functions.invoke("generate-blog", {
          body: { topic, style: aiStyle },
        });
        if (!error && data?.content) content = data.content;
      } catch { /* proceed without AI content */ }

      let heroUrl = "";
      try {
        const { data } = await supabase.functions.invoke("search-stock-images", {
          body: { query: topic, perPage: 1 },
        });
        if (data?.images?.[0]) heroUrl = data.images[0].url;
      } catch { /* ok */ }

      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
      const { data: post, error: postError } = await supabase
        .from("blog_posts" as any)
        .insert({
          user_id: user!.id, blog_site_id: siteId, title,
          content, hero_image_url: heroUrl || null, slug, status: "draft",
        } as any)
        .select("id")
        .single();
      if (postError) throw postError;

      await supabase.from("campaign_blog_posts").insert({
        campaign_id: campaign.id, blog_post_id: (post as any).id,
      });

      await supabase.functions.invoke("deduct-credits", { body: { amount: 2 } });
    },
    onSuccess: () => {
      toast.success("Blog post created!");
      setCreateOpen(false);
      setNewPostTitle("");
      setNewPostTopic("");
      queryClient.invalidateQueries({ queryKey: ["campaign-blog-posts"] });
      queryClient.invalidateQueries({ queryKey: ["blog-sites"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("campaign_blog_posts").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Blog post unlinked");
      queryClient.invalidateQueries({ queryKey: ["campaign-blog-posts"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Blog Posts</p>
          <p className="text-xs text-muted-foreground">SEO-optimized blog content for this campaign</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gradient-primary text-primary-foreground hover:opacity-90">
          <Plus className="h-3.5 w-3.5 mr-1" />New Blog Post
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !links?.length ? (
        <Card className="glass border-dashed">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-8 w-8 text-primary/40" />
            </div>
            <p className="text-sm font-medium mb-1">No blog posts yet</p>
            <p className="text-xs text-muted-foreground">Create your first AI-generated, SEO-optimized blog post</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {links.map((link) => {
            const post = link.blog_post;
            if (!post) return null;
            return (
              <Card key={link.id} className="glass group overflow-hidden hover:shadow-glow transition-all hover:-translate-y-0.5">
                {/* Hero image */}
                <div className="relative h-40 bg-muted/5 overflow-hidden">
                  {post.hero_image_url ? (
                    <img src={post.hero_image_url} alt={post.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
                      <BookOpen className="h-10 w-10 text-muted-foreground/15" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                  {/* Hover actions */}
                  <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {post.slug && post.status === "published" && (
                      <Button variant="secondary" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm" onClick={() => window.open(`/blog/${post.blog_site_id}/${post.slug}`, "_blank")}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                    <Button variant="secondary" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm text-destructive" onClick={() => unlinkMutation.mutate(link.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {/* Status badge */}
                  <div className="absolute bottom-3 left-3">
                    <Badge variant={post.status === "published" ? "default" : "secondary"} className="text-[10px] backdrop-blur-sm">
                      {post.status}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-4">
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(post.created_at), "MMM d, yyyy")}
                  </span>
                  <h3 className="text-sm font-semibold line-clamp-2 leading-snug mt-1">{post.title || "Untitled"}</h3>
                  {post.content && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                      {post.content.replace(/[#*_\[\]`>]/g, "").slice(0, 160)}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />New Blog Post
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Post Title</Label>
              <Input placeholder="e.g. How to Grow Your SaaS in 2025" value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} className="bg-secondary/50 border-border/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Topic (for AI generation)</Label>
              <Textarea placeholder="Describe what the post should cover…" value={newPostTopic} onChange={(e) => setNewPostTopic(e.target.value)} rows={2} className="bg-secondary/50 border-border/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Writing Style</Label>
              <Select value={aiStyle} onValueChange={setAiStyle}>
                <SelectTrigger className="bg-secondary/50 border-border/50 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["informative", "tutorial", "opinion", "listicle", "case-study", "storytelling"].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {blogSites && blogSites.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Blog Site</Label>
                <Select value={selectedSiteId || ""} onValueChange={setSelectedSiteId}>
                  <SelectTrigger className="bg-secondary/50 border-border/50 h-9 text-sm"><SelectValue placeholder="Auto-select" /></SelectTrigger>
                  <SelectContent>
                    {blogSites.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="rounded-lg border border-primary/10 bg-primary/5 p-3 text-xs text-muted-foreground">
              AI generates SEO-optimized content + auto-fetches hero image · <strong>2 credits</strong>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createPostMutation.mutate()} disabled={createPostMutation.isPending || !newPostTitle.trim()} className="gradient-primary text-primary-foreground">
              {createPostMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating…</> : <><Sparkles className="h-4 w-4 mr-2" />Create Post</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
