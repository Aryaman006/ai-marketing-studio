import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Globe, Loader2, Plus, Trash2, FileText, ExternalLink, ImagePlus, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";

interface BlogSite {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface Props {
  onSelectSite: (site: BlogSite) => void;
}

export function BlogSitesList({ onSelectSite }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: sites, isLoading } = useQuery({
    queryKey: ["blog-sites", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_sites" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as unknown as BlogSite[];
    },
    enabled: !!user,
  });

  const { data: postCounts } = useQuery({
    queryKey: ["blog-post-counts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts" as any)
        .select("blog_site_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data as any[]).forEach((p) => {
        counts[p.blog_site_id] = (counts[p.blog_site_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!user,
  });

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !user) return null;
    setUploading(true);
    try {
      const ext = logoFile.name.split(".").pop() || "png";
      const path = `${user.id}/blog-logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("assets").upload(path, logoFile, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      return urlData.publicUrl;
    } catch (err: any) {
      toast.error("Logo upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name is required");
      let logoUrl: string | null = null;
      if (logoFile) logoUrl = await uploadLogo();
      const { error } = await supabase.from("blog_sites" as any).insert({
        user_id: user!.id,
        name: trimmed,
        description: description.trim() || null,
        logo_url: logoUrl,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Blog site created!");
      setShowCreate(false);
      setName("");
      setDescription("");
      setLogoFile(null);
      setLogoPreview(null);
      queryClient.invalidateQueries({ queryKey: ["blog-sites"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blog_sites" as any).delete().eq("id", id).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Blog site deleted");
      queryClient.invalidateQueries({ queryKey: ["blog-sites"] });
    },
    onError: () => toast.error("Failed to delete"),
  });

  return (
    <>
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/10 p-8 mb-2">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Blog CMS</h1>
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Create & manage professional blog sites with AI-powered content, SEO optimization, and beautiful templates.
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} size="lg" className="gradient-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20">
            <Plus className="mr-2 h-4 w-4" />New Blog Site
          </Button>
        </div>
      </div>

      {/* Sites Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !sites?.length ? (
        <Card className="border-dashed border-2 border-border/50">
          <CardContent className="py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <Globe className="h-10 w-10 text-primary/40" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No blog sites yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Create your first blog site to start publishing SEO-optimized articles with AI assistance.
            </p>
            <Button onClick={() => setShowCreate(true)} className="gradient-primary text-primary-foreground">
              <Plus className="mr-2 h-4 w-4" />Create Your First Blog
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => {
            const count = postCounts?.[site.id] || 0;
            return (
              <Card
                key={site.id}
                className="group cursor-pointer overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1"
                onClick={() => onSelectSite(site)}
              >
                {/* Site Header with gradient */}
                <div className="relative h-28 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 overflow-hidden">
                  <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 30% 70%, hsl(var(--primary) / 0.3) 0%, transparent 50%)" }} />
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent" />
                  {/* Logo */}
                  <div className="absolute bottom-0 left-5 translate-y-1/2 z-10">
                    {site.logo_url ? (
                      <img src={site.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover border-4 border-card shadow-lg" />
                    ) : (
                      <div className="h-14 w-14 rounded-xl bg-card border-4 border-card shadow-lg flex items-center justify-center">
                        <span className="text-xl font-bold text-primary">{site.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(site.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <CardContent className="pt-10 pb-5 px-5">
                  <h3 className="font-bold text-base mb-1 group-hover:text-primary transition-colors">{site.name}</h3>
                  {site.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{site.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5 bg-secondary/50 px-2 py-1 rounded-md">
                        <FileText className="h-3 w-3" />
                        {count} {count === 1 ? "post" : "posts"}
                      </span>
                      <span>{format(new Date(site.updated_at), "MMM d")}</span>
                    </div>
                    <Link
                      to={`/blog/${site.id}`}
                      target="_blank"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create Blog Site</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Logo Upload */}
            <div className="space-y-2">
              <Label className="text-xs">Site Logo / Favicon (optional)</Label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
              <div className="flex items-center gap-3">
                {logoPreview ? (
                  <div className="relative">
                    <img src={logoPreview} alt="Logo preview" className="h-14 w-14 rounded-xl object-cover border border-border/50" />
                    <button onClick={() => { setLogoFile(null); setLogoPreview(null); }} className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center text-[8px]">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-14 w-14 rounded-xl border-2 border-dashed border-border/50 flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <ImagePlus className="h-5 w-5 text-muted-foreground/50" />
                  </button>
                )}
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium">Upload a logo or icon</p>
                  <p>Used as site favicon and header logo. You can change it later.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Site Name</Label>
              <Input placeholder="e.g. My Tech Blog" value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary/50 border-border/50" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea placeholder="What is this blog about?" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="bg-secondary/50 border-border/50" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || uploading || !name.trim()} className="gradient-primary text-primary-foreground">
              {(createMutation.isPending || uploading) ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
