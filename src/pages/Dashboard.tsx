import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useCampaign } from "@/contexts/CampaignContext";
import { useProfile, useCredits, useRecentGenerations } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Zap, Clock, Megaphone, Plus, ArrowRight,
  Sparkles, BookOpen, TrendingUp, FileText, Globe, Image,
} from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

const typeConfig: Record<string, { icon: typeof FileText; label: string; route: string; color: string }> = {
  post: { icon: FileText, label: "Post", route: "/campaigns", color: "text-blue-400" },
  landing: { icon: Globe, label: "Landing Page", route: "/campaigns", color: "text-emerald-400" },
  landing_page: { icon: Globe, label: "Landing Page", route: "/campaigns", color: "text-emerald-400" },
  asset: { icon: Image, label: "Asset", route: "/campaigns", color: "text-amber-400" },
  blog: { icon: BookOpen, label: "Blog", route: "/blogs", color: "text-purple-400" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: credits } = useCredits();
  const { data: generations } = useRecentGenerations();
  const { campaigns, activeCampaign } = useCampaign();
  const navigate = useNavigate();

  const planName = (credits?.plans as any)?.name ?? "Free";
  const creditsLeft = credits?.credits_remaining ?? 0;
  const creditsTotal = (credits?.plans as any)?.credits_per_month ?? 50;
  const creditsPercent = Math.min((creditsLeft / creditsTotal) * 100, 100);

  const quickActions = activeCampaign
    ? [
        { label: "Open Campaign", icon: Megaphone, route: `/campaigns/${activeCampaign.id}`, desc: activeCampaign.name },
        { label: "Blog Post", icon: BookOpen, route: "/blogs", desc: "Long-form content" },
      ]
    : [
        { label: "New Campaign", icon: Megaphone, route: "/campaigns", desc: "Start a brand" },
        { label: "Blog Post", icon: BookOpen, route: "/blogs", desc: "Long-form content" },
      ];

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-8 animate-fade-in">
        {/* Welcome */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Welcome back, {profile?.full_name?.split(" ")[0] || "there"} 👋
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
              {activeCampaign
                ? <>Working on <span className="text-primary font-medium">{activeCampaign.name}</span></>
                : "Select a campaign or start creating content"
              }
            </p>
          </div>
          {!campaigns.length && (
            <Button onClick={() => navigate("/campaigns")} className="gradient-primary text-primary-foreground w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />New Campaign
            </Button>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="glass group hover:shadow-glow transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Credits</span>
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{creditsLeft}</p>
              <Progress value={creditsPercent} className="h-1.5 mt-2" />
              <p className="text-xs text-muted-foreground mt-1.5">{creditsLeft} of {creditsTotal} remaining</p>
            </CardContent>
          </Card>

          <Card className="glass group hover:shadow-glow transition-shadow cursor-pointer" onClick={() => navigate("/campaigns")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Campaigns</span>
                <Megaphone className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{campaigns.length}</p>
              <p className="text-xs text-muted-foreground mt-1.5">
                {activeCampaign ? `Active: ${activeCampaign.name}` : "No campaign selected"}
              </p>
            </CardContent>
          </Card>

          <Card className="glass group hover:shadow-glow transition-shadow cursor-pointer" onClick={() => navigate("/analytics")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Generations</span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{generations?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1.5">Recent content pieces</p>
            </CardContent>
          </Card>

          <Card className="glass group hover:shadow-glow transition-shadow cursor-pointer" onClick={() => navigate("/credits")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan</span>
                <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">{planName}</Badge>
              </div>
              <p className="text-3xl font-bold">${(credits?.plans as any)?.price ?? 0}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <p className="text-xs text-muted-foreground mt-1.5">View usage details →</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Card
                key={action.label}
                className="glass cursor-pointer group hover:shadow-glow hover:border-primary/30 transition-all"
                onClick={() => navigate(action.route)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <action.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 ml-auto shrink-0 group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Campaign CTA if none */}
        {!campaigns.length && (
          <Card className="glass border-primary/20 overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center gap-6 p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl gradient-primary shadow-glow">
                  <Megaphone className="h-7 w-7 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Start with a Campaign</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Set your brand voice, colors, and audience — then generate content that's always on-brand.
                  </p>
                </div>
                <Button onClick={() => navigate("/campaigns")} className="gradient-primary text-primary-foreground shrink-0">
                  <Sparkles className="mr-2 h-4 w-4" />Get Started
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Activity</h2>
            {(generations?.length ?? 0) > 0 && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => navigate("/analytics")}>
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>
          <Card className="glass">
            <CardContent className="p-0">
              {!generations?.length ? (
                <div className="py-12 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No activity yet. Create your first piece of content!</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {generations.map((gen) => {
                    const config = typeConfig[gen.type] ?? { icon: FileText, label: gen.type, route: "/posts", color: "text-muted-foreground" };
                    const Icon = config.icon;
                    return (
                      <div
                        key={gen.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
                        onClick={() => navigate(config.route)}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/50">
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{gen.title || "Untitled"}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(gen.created_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{config.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
