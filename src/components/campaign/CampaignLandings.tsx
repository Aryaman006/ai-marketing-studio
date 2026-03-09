import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Campaign } from "@/contexts/CampaignContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Globe, Loader2, Trash2, ExternalLink, Sparkles, Eye, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

type LandingPage = {
  id: string; title: string | null; topic: string | null; slug: string | null;
  html_content: string | null; is_public: boolean; created_at: string; updated_at: string;
  user_id: string; campaign_id?: string | null;
};

export default function CampaignLandings({ campaign }: { campaign: Campaign }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  // Get landing pages linked to this campaign
  const { data: pages, isLoading } = useQuery({
    queryKey: ["landing-pages", user?.id, campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("user_id", user!.id)
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LandingPage[];
    },
    enabled: !!user,
  });

  const unlinkMutation = useMutation({
    mutationFn: async (id: string) => {
      // Remove campaign association (don't delete the page)
      const { error } = await supabase
        .from("landing_pages")
        .update({ campaign_id: null })
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Landing page unlinked from campaign");
      queryClient.invalidateQueries({ queryKey: ["landing-pages"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("landing_pages").delete().eq("id", id).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Landing page deleted");
      queryClient.invalidateQueries({ queryKey: ["landing-pages"] });
    },
  });

  const publicUrl = (slug: string) => `${window.location.origin}/public/landing/${slug}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Landing Pages</p>
          <p className="text-xs text-muted-foreground">Pages linked to this campaign</p>
        </div>
        <Button
          size="sm"
          onClick={() => navigate("/landing-pages")}
          className="gradient-primary text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />Create in Landing Pages
        </Button>
      </div>

      {/* Preview */}
      {previewHtml && (
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-sm font-medium"><Eye className="h-4 w-4 text-primary" />Preview</span>
              <Button variant="ghost" size="sm" onClick={() => setPreviewHtml(null)}>Close</Button>
            </div>
            <iframe srcDoc={previewHtml} className="w-full h-[500px] rounded-xl border border-border/50 bg-white" sandbox="allow-scripts" title="Preview" />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !pages?.length ? (
        <Card className="glass border-dashed">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Globe className="h-8 w-8 text-primary/40" />
            </div>
            <p className="text-sm font-medium mb-1">No landing pages linked</p>
            <p className="text-xs text-muted-foreground mb-4">Create landing pages from the Landing Pages section and link them to this campaign</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/landing-pages")}>
              <Globe className="h-3.5 w-3.5 mr-1" />Go to Landing Pages
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {pages.map((page) => (
            <Card key={page.id} className="glass group overflow-hidden hover:shadow-glow transition-all hover:-translate-y-0.5">
              <div className="relative h-40 bg-muted/5 border-b border-border/20 overflow-hidden">
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
                  {page.slug && page.is_public && (
                    <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => window.open(publicUrl(page.slug!), "_blank")}>
                      <ExternalLink className="h-3 w-3 mr-1" />Visit
                    </Button>
                  )}
                </div>
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm truncate">{page.title || "Untitled"}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(page.created_at), "MMM d, yyyy")}</p>
                  </div>
                  <Badge variant={page.is_public ? "default" : "secondary"} className="text-[10px] shrink-0">{page.is_public ? "Public" : "Private"}</Badge>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => unlinkMutation.mutate(page.id)}>
                    Unlink
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-auto" onClick={() => deleteMutation.mutate(page.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
