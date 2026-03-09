import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCampaign } from "@/contexts/CampaignContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Loader2, Trash2, Download, Play, RefreshCw, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useState } from "react";
import VideoCreator from "@/components/video/VideoCreator";
import VideoRenderer, { SceneData } from "@/components/video/VideoRenderer";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface VideoRow {
  id: string;
  title: string;
  description: string | null;
  scene_data: SceneData | null;
  video_url: string | null;
  thumbnail_url: string | null;
  campaign_id: string | null;
  status: string;
  created_at: string;
}

export default function Videos() {
  const { user } = useAuth();
  const { activeCampaign } = useCampaign();
  const queryClient = useQueryClient();
  const [previewVideo, setPreviewVideo] = useState<VideoRow | null>(null);
  const [editingVideo, setEditingVideo] = useState<VideoRow | null>(null);

  const { data: videos, isLoading } = useQuery({
    queryKey: ["videos", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as VideoRow[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (video: VideoRow) => {
      const { error } = await supabase
        .from("videos" as any)
        .delete()
        .eq("id", video.id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Video deleted");
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
  });

  const downloadVideo = async (video: VideoRow) => {
    if (!video.video_url) { toast.error("No exported video available"); return; }
    try {
      const res = await fetch(video.video_url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${video.title || "video"}.webm`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast.error("Failed to download"); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Videos</h1>
          <p className="text-sm text-muted-foreground">Create motion graphics & marketing reels</p>
        </div>

        <VideoCreator
          campaign={activeCampaign}
          editingVideo={editingVideo}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["videos"] });
            setEditingVideo(null);
          }}
          onCancelEdit={() => setEditingVideo(null)}
        />

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !videos?.length ? (
          <Card className="glass border-dashed">
            <CardContent className="py-12 text-center">
              <Video className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No videos yet. Create your first motion graphic above!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.map((video) => (
              <Card key={video.id} className="glass group overflow-hidden hover:shadow-glow transition-all hover:-translate-y-0.5">
                <div className="relative aspect-[9/16] max-h-[280px] bg-muted/10 overflow-hidden rounded-t-xl">
                  {video.scene_data ? (
                    <VideoRenderer sceneData={video.scene_data} autoPlay={false} showControls={false} className="h-full" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/10">
                      <Video className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="default" size="sm" className="h-8 text-xs w-28" onClick={() => setPreviewVideo(video)}>
                      <Play className="h-3 w-3 mr-1" />Play
                    </Button>
                    <Button variant="secondary" size="sm" className="h-8 text-xs w-28" onClick={() => setEditingVideo(video)}>
                      <Pencil className="h-3 w-3 mr-1" />Edit
                    </Button>
                    {video.video_url && (
                      <Button variant="secondary" size="sm" className="h-8 text-xs w-28" onClick={() => downloadVideo(video)}>
                        <Download className="h-3 w-3 mr-1" />Download
                      </Button>
                    )}
                    <Button variant="destructive" size="sm" className="h-8 text-xs w-28" onClick={() => deleteMutation.mutate(video)}>
                      <Trash2 className="h-3 w-3 mr-1" />Delete
                    </Button>
                  </div>
                </div>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Video</Badge>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(video.created_at), "MMM d")}</span>
                  </div>
                  <p className="text-sm font-medium truncate">{video.title || "Untitled"}</p>
                  {video.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{video.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{previewVideo?.title || "Video Preview"}</DialogTitle>
            </DialogHeader>
            {previewVideo?.scene_data && (
              <div className="max-w-xs mx-auto">
                <VideoRenderer sceneData={previewVideo.scene_data} autoPlay showControls />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setEditingVideo(previewVideo); setPreviewVideo(null); }}>
                <Pencil className="h-3 w-3 mr-1" />Edit
              </Button>
              {previewVideo?.video_url && (
                <Button variant="secondary" size="sm" onClick={() => previewVideo && downloadVideo(previewVideo)}>
                  <Download className="h-3 w-3 mr-1" />Download
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
