import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Loader2, Trash2, Edit, Eye, Sparkles, ExternalLink, ImagePlus, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { BlogPostEditor } from "./BlogPostEditor";

interface BlogSite {
  id: string;
  name: string;
  description: string | null;
  logo_url?: string | null;
}

interface BlogPost {
  id: string;
  blog_site_id: string;
  user_id: string;
  title: string;
  content: string | null;
  hero_image_url: string | null;
  images: any;
  status: string;
  slug: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  site: BlogSite;
  onBack: () => void;
}

function estimateReadTime(content: string): number {
  return Math.max(1, Math.round((content?.split(/\s+/).length || 0) / 200));
}

export function BlogSiteDetail({ site, onBack }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["blog-posts", site.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts" as any)
        .select("*")
        .eq("blog_site_id", site.id)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as BlogPost[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("blog_posts" as any)
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post deleted");
      queryClient.invalidateQueries({ queryKey: ["blog-posts", site.id] });
    },
    onError: () => toast.error("Failed to delete"),
  });

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/blog-logo-${site.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      await supabase.from("blog_sites" as any).update({ logo_url: urlData.publicUrl } as any).eq("id", site.id);
      toast.success("Logo updated!");
      queryClient.invalidateQueries({ queryKey: ["blog-sites"] });
    } catch {
      toast.error("Failed to upload logo");
    }
    e.target.value = "";
  };

  if (editingPost || isCreating) {
    return (
      <BlogPostEditor
        site={site}
        post={editingPost}
        onBack={() => { setEditingPost(null); setIsCreating(false); }}
        onSaved={() => {
          setEditingPost(null);
          setIsCreating(false);
          queryClient.invalidateQueries({ queryKey: ["blog-posts", site.id] });
        }}
      />
    );
  }

  const publishedPosts = posts?.filter(p => p.status === "published") || [];
  const draftPosts = posts?.filter(p => p.status === "draft") || [];

  return (
    <>
      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />

      {/* Site Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/10 p-6 mb-2">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          {/* Logo with change option */}
          <button onClick={() => logoInputRef.current?.click()} className="shrink-0 group relative">
            {(site as any).logo_url ? (
              <img src={(site as any).logo_url} alt="" className="h-16 w-16 rounded-xl object-cover border-2 border-card shadow-lg" />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-card border-2 border-card shadow-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">{site.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ImagePlus className="h-4 w-4 text-white" />
            </div>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{site.name}</h1>
            {site.description && <p className="text-sm text-muted-foreground mt-0.5">{site.description}</p>}
            <div className="flex items-center gap-3 mt-2">
              <Link to={`/blog/${site.id}`} target="_blank" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />View public blog
              </Link>
              <Badge variant="secondary" className="text-[10px]">{posts?.length ?? 0} posts</Badge>
              <Badge variant="outline" className="text-[10px]">{publishedPosts.length} published</Badge>
            </div>
          </div>

          <Button onClick={() => setIsCreating(true)} className="gradient-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20">
            <Plus className="mr-2 h-4 w-4" />New Post
          </Button>
        </div>
      </div>

      {/* Posts */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !posts?.length ? (
        <Card className="border-dashed border-2 border-border/50">
          <CardContent className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-primary/40" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Start writing</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Create your first blog post with AI assistance or write from scratch.
            </p>
            <Button onClick={() => setIsCreating(true)} className="gradient-primary text-primary-foreground">
              <Sparkles className="mr-2 h-4 w-4" />Create with AI
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Featured / Latest Published */}
          {publishedPosts.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Published</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {publishedPosts.map((post, i) => (
                  <Card
                    key={post.id}
                    className={`group overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer ${i === 0 && publishedPosts.length > 2 ? "sm:col-span-2 lg:col-span-2" : ""}`}
                    onClick={() => setEditingPost(post)}
                  >
                    {/* Hero thumbnail */}
                    <div className={`relative overflow-hidden ${i === 0 && publishedPosts.length > 2 ? "h-48" : "h-36"}`}>
                      {post.hero_image_url ? (
                        <img src={post.hero_image_url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center">
                          <span className="text-4xl opacity-20">✍️</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                      {/* Actions overlay */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {post.slug && (
                          <Link to={`/blog/${site.id}/${post.slug}`} target="_blank" onClick={(e) => e.stopPropagation()}>
                            <Button variant="secondary" size="icon" className="h-7 w-7 bg-card/80 backdrop-blur-sm">
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </Link>
                        )}
                        <Button variant="secondary" size="icon" className="h-7 w-7 bg-card/80 backdrop-blur-sm text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(post.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <Badge variant="default" className="text-[10px] mb-2">Published</Badge>
                      <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-1.5 group-hover:text-primary transition-colors">{post.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {post.content?.replace(/[#*_\[\]`]/g, "").slice(0, 120)}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>{format(new Date(post.updated_at), "MMM d, yyyy")}</span>
                        <span>·</span>
                        <span>{estimateReadTime(post.content || "")} min read</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Drafts */}
          {draftPosts.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Drafts</h2>
              <div className="space-y-2">
                {draftPosts.map((post) => (
                  <div
                    key={post.id}
                    className="group flex items-center gap-4 rounded-xl border border-border/50 bg-secondary/20 p-4 transition-all hover:bg-secondary/40 hover:border-primary/20 cursor-pointer"
                    onClick={() => setEditingPost(post)}
                  >
                    <div className="h-12 w-12 rounded-lg bg-muted/30 overflow-hidden shrink-0">
                      {post.hero_image_url ? (
                        <img src={post.hero_image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Edit className="h-4 w-4 text-muted-foreground/30" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium line-clamp-1">{post.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Last edited {format(new Date(post.updated_at), "MMM d, yyyy")} · {estimateReadTime(post.content || "")} min read
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingPost(post); }}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(post.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
