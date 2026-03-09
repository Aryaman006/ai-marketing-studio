import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Campaign } from "@/contexts/CampaignContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FileText, Loader2, Trash2, Copy, Sparkles, ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { trackEvent } from "@/lib/tracking";

const TONES = ["professional", "casual", "humorous", "inspirational", "educational", "provocative", "storytelling"];

export default function CampaignPosts({ campaign }: { campaign: Campaign }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");
  const [generatorOpen, setGeneratorOpen] = useState(true);

  const effectiveTone = campaign.brand_tone || "professional";

  const { data: posts, isLoading } = useQuery({
    queryKey: ["posts", user?.id, campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generations")
        .select("*")
        .eq("user_id", user!.id)
        .eq("type", "post")
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const trimmedTopic = topic.trim();
      if (!trimmedTopic) throw new Error("Topic is required");
      const brandContext = {
        tone: campaign.brand_tone,
        brandType: campaign.brand_type,
        targetAudience: campaign.target_audience,
      };
      const { data: fnData, error: fnError } = await supabase.functions.invoke("generate-post", {
        body: { topic: trimmedTopic, tone: effectiveTone, ...brandContext },
      });
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);
      const content = fnData.content;
      const { error: insertError } = await supabase.from("generations").insert({
        user_id: user!.id, type: "post", title: trimmedTopic,
        input: { topic: trimmedTopic, tone: effectiveTone, campaignId: campaign.id },
        output: content, campaign_id: campaign.id,
      });
      if (insertError) throw insertError;
      // Deduct credits server-side
      const { data: creditData, error: creditError } = await supabase.functions.invoke("deduct-credits", {
        body: { amount: 1 },
      });
      if (creditError || creditData?.error) {
        console.warn("Credit deduction failed:", creditData?.error || creditError);
      }
      return content;
    },
    onSuccess: () => {
      toast.success("Post generated!");
      setTopic("");
      setGeneratorOpen(false);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("generations").delete().eq("id", id).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post deleted");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  const downloadPost = (text: string, title: string) => {
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title || "post"}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <Collapsible open={generatorOpen} onOpenChange={setGeneratorOpen}>
        <Card className="glass">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-secondary/20 transition-colors rounded-t-xl">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />Generate a Post
                  <Badge variant="secondary" className="text-[10px] ml-1">1 credit</Badge>
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${generatorOpen ? "rotate-180" : ""}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="space-y-2">
                <Label className="text-xs">Topic</Label>
                <Input
                  placeholder="e.g. Benefits of remote work for startups"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && topic.trim() && generateMutation.mutate()}
                  maxLength={500}
                  className="bg-secondary/50 border-border/50"
                />
              </div>
              <div className="rounded-lg border border-primary/10 bg-primary/5 p-3 text-xs text-muted-foreground">
                Using <strong>{campaign.name}</strong> brand: {campaign.brand_tone} tone, {campaign.brand_type} style
              </div>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !topic.trim()}
                className="gradient-primary text-primary-foreground hover:opacity-90"
              >
                {generateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</> : <><Sparkles className="mr-2 h-4 w-4" />Generate Post</>}
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !posts?.length ? (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No posts yet. Generate your first one above!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} className="glass group hover:shadow-glow transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-medium">{post.title || "Untitled"}</h3>
                    <Badge variant="outline" className="text-[10px] capitalize border-primary/30 text-primary">
                      {(post.input as any)?.tone ?? "post"}
                    </Badge>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(post.output ?? "")}><Copy className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadPost(post.output ?? "", post.title ?? "")}><Download className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(post.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <div className="rounded-lg bg-background/50 p-4 text-sm leading-relaxed whitespace-pre-wrap border border-border/30">{post.output}</div>
                <p className="text-xs text-muted-foreground mt-2">{format(new Date(post.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
