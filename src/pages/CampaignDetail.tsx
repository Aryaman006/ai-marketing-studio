import { useParams, useNavigate } from "react-router-dom";
import { useCampaign } from "@/contexts/CampaignContext";
import { CampaignLayout } from "@/components/CampaignLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Globe, Image, BookOpen, Video, Loader2 } from "lucide-react";
import { useEffect } from "react";
import CampaignPosts from "@/components/campaign/CampaignPosts";
import CampaignLandings from "@/components/campaign/CampaignLandings";
import CampaignAssets from "@/components/campaign/CampaignAssets";
import CampaignBlogs from "@/components/campaign/CampaignBlogs";
import CampaignVideos from "@/components/campaign/CampaignVideos";

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { campaigns, isLoading, setActiveCampaignId } = useCampaign();
  const campaign = campaigns.find((c) => c.id === id);

  useEffect(() => {
    if (id) setActiveCampaignId(id);
  }, [id, setActiveCampaignId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    navigate("/campaigns");
    return null;
  }

  return (
    <CampaignLayout campaign={campaign}>
      <div className="space-y-6 animate-fade-in">
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="bg-secondary/50 border border-border/50">
            <TabsTrigger value="posts" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />Posts
            </TabsTrigger>
            <TabsTrigger value="landings" className="gap-1.5 text-xs">
              <Globe className="h-3.5 w-3.5" />Landing Pages
            </TabsTrigger>
            <TabsTrigger value="assets" className="gap-1.5 text-xs">
              <Image className="h-3.5 w-3.5" />Assets
            </TabsTrigger>
            <TabsTrigger value="blogs" className="gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" />Blog Posts
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-1.5 text-xs">
              <Video className="h-3.5 w-3.5" />Videos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-6">
            <CampaignPosts campaign={campaign} />
          </TabsContent>
          <TabsContent value="landings" className="mt-6">
            <CampaignLandings campaign={campaign} />
          </TabsContent>
          <TabsContent value="assets" className="mt-6">
            <CampaignAssets campaign={campaign} />
          </TabsContent>
          <TabsContent value="blogs" className="mt-6">
            <CampaignBlogs campaign={campaign} />
          </TabsContent>
          <TabsContent value="videos" className="mt-6">
            <CampaignVideos campaign={campaign} />
          </TabsContent>
        </Tabs>
      </div>
    </CampaignLayout>
  );
}
