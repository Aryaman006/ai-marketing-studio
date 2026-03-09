import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BarChart3, TrendingUp, Activity,
  Link2, Plus, Copy, Trash2, MousePointerClick, Eye, Users,
  Globe, BookOpen, FileText
} from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const CHART_COLORS = [
  "hsl(262, 83%, 58%)",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(200, 80%, 50%)",
];

function useAnalyticsEvents(userId: string | undefined) {
  return useQuery({
    queryKey: ["analytics-events", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("analytics_events")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(1000);
      return data || [];
    },
    enabled: !!userId,
  });
}

function filterByType(events: any[], contentType: string) {
  return events.filter(e => (e.metadata as any)?.content_type === contentType);
}

function buildTimeChart(events: any[], eventTypes: string[]) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayStart = startOfDay(date);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const result: any = { day: format(date, "EEE") };
    eventTypes.forEach(type => {
      result[type] = events.filter(e => {
        if (e.event_type !== type) return false;
        const d = new Date(e.created_at);
        return d >= dayStart && d < dayEnd;
      }).length;
    });
    return result;
  });
}

export default function Analytics() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: analyticsEvents } = useAnalyticsEvents(user?.id);

  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkSource, setNewLinkSource] = useState("");

  // Tracked links
  const { data: trackedLinks } = useQuery({
    queryKey: ["tracked-links", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tracked_links")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const createLinkMutation = useMutation({
    mutationFn: async () => {
      const shortCode = Math.random().toString(36).substring(2, 8);
      const { error } = await supabase.from("tracked_links").insert({
        user_id: user!.id,
        label: newLinkLabel || "Untitled",
        destination_url: newLinkUrl,
        short_code: shortCode,
        utm_source: newLinkSource || null,
        utm_medium: "social",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tracked link created");
      setNewLinkLabel("");
      setNewLinkUrl("");
      setNewLinkSource("");
      queryClient.invalidateQueries({ queryKey: ["tracked-links"] });
    },
    onError: () => toast.error("Failed to create link"),
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("tracked_links").delete().eq("id", id);
    },
    onSuccess: () => {
      toast.success("Link deleted");
      queryClient.invalidateQueries({ queryKey: ["tracked-links"] });
    },
  });

  // Aggregate metrics
  const allEvents = analyticsEvents || [];
  const viewCount = allEvents.filter(e => e.event_type === "view").length;
  const clickCount = allEvents.filter(e => e.event_type === "click").length;
  const leadCount = allEvents.filter(e => e.event_type === "lead").length;
  const ctaCount = allEvents.filter(e => e.event_type === "cta_click").length;

  // Top referrers
  const topReferrers = (() => {
    const refs: Record<string, number> = {};
    allEvents.forEach(e => {
      const meta = e.metadata as any;
      const source = meta?.utm_source || (meta?.referrer ? (() => { try { return new URL(meta.referrer).hostname; } catch { return "direct"; } })() : null) || "direct";
      refs[source] = (refs[source] || 0) + 1;
    });
    return Object.entries(refs).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([source, count]) => ({ source, count }));
  })();

  const baseUrl = window.location.origin;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <Badge variant="secondary" className="text-xs">Last 7 days</Badge>
        </div>

        {/* Top-level stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Eye} label="Total Views" value={viewCount} color="text-primary" />
          <StatCard icon={MousePointerClick} label="Link Clicks" value={clickCount} color="text-success" />
          <StatCard icon={Users} label="Leads" value={leadCount} color="text-warning" />
          <StatCard icon={MousePointerClick} label="CTA Clicks" value={ctaCount} color="text-primary" />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="landing">Landing Pages</TabsTrigger>
            <TabsTrigger value="blog">Blog Posts</TabsTrigger>
            <TabsTrigger value="social">Social Posts</TabsTrigger>
            <TabsTrigger value="links">Tracked Links</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard title="Views & Clicks (7 Days)" icon={TrendingUp}>
                <TimeBarChart data={buildTimeChart(allEvents, ["view", "click", "cta_click"])} bars={[
                  { key: "view", fill: CHART_COLORS[0], name: "Views" },
                  { key: "click", fill: CHART_COLORS[1], name: "Clicks" },
                  { key: "cta_click", fill: CHART_COLORS[2], name: "CTA Clicks" },
                ]} />
              </ChartCard>

              <ChartCard title="Top Sources" icon={Activity}>
                {topReferrers.length > 0 ? (
                  <div className="space-y-3">
                    {topReferrers.map(ref => (
                      <div key={ref.source} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{ref.source}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-2 rounded-full bg-primary/20 w-24">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${(ref.count / topReferrers[0].count) * 100}%` }} />
                          </div>
                          <span className="text-sm font-medium w-8 text-right">{ref.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No referrer data yet</p>
                )}
              </ChartCard>
            </div>
          </TabsContent>

          {/* LANDING PAGES */}
          <TabsContent value="landing" className="space-y-6">
            <ContentAnalyticsTab events={allEvents} contentType="landing_page" label="Landing Page" />
          </TabsContent>

          {/* BLOG POSTS */}
          <TabsContent value="blog" className="space-y-6">
            <ContentAnalyticsTab events={allEvents} contentType="blog_post" label="Blog Post" />
          </TabsContent>

          {/* SOCIAL POSTS */}
          <TabsContent value="social" className="space-y-6">
            <ContentAnalyticsTab events={allEvents} contentType="social_post" label="Social Post" />
          </TabsContent>

          {/* TRACKED LINKS */}
          <TabsContent value="links" className="space-y-4">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Link2 className="h-4 w-4 text-primary" />
                  Tracked Links
                  <span className="text-xs text-muted-foreground font-normal ml-1">Share on social media to track clicks</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input placeholder="Label (e.g. Twitter Bio)" value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)} className="sm:w-40" />
                  <Input placeholder="Destination URL" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} className="flex-1" />
                  <Input placeholder="Source (e.g. twitter)" value={newLinkSource} onChange={e => setNewLinkSource(e.target.value)} className="sm:w-32" />
                  <Button
                    onClick={() => createLinkMutation.mutate()}
                    disabled={!newLinkUrl.trim() || createLinkMutation.isPending}
                    className="gradient-primary text-primary-foreground hover:opacity-90"
                  >
                    <Plus className="h-4 w-4 mr-1" />Create
                  </Button>
                </div>

                {trackedLinks?.length ? (
                  <div className="space-y-2">
                    {trackedLinks.map((link) => (
                      <div key={link.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/20 p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{link.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{link.destination_url}</p>
                        </div>
                        <Badge variant="secondary" className="shrink-0">{link.click_count} clicks</Badge>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => {
                            navigator.clipboard.writeText(`${baseUrl}/t/${link.short_code}`);
                            toast.success("Tracking link copied!");
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => deleteLinkMutation.mutate(link.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Create tracked links to measure social media clicks and traffic sources.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

/* ─── Content Analytics Tab (reused for landing, blog, social) ─── */
function ContentAnalyticsTab({ events, contentType, label }: { events: any[]; contentType: string; label: string }) {
  const filtered = filterByType(events, contentType);
  const views = filtered.filter(e => e.event_type === "view");
  const ctaClicks = filtered.filter(e => e.event_type === "cta_click");
  const clicks = filtered.filter(e => e.event_type === "click");

  // Per-content breakdown
  const contentBreakdown = (() => {
    const map: Record<string, { title: string; views: number; cta: number; clicks: number }> = {};
    filtered.forEach(e => {
      const meta = e.metadata as any;
      const key = meta?.content_slug || meta?.content_title || "unknown";
      if (!map[key]) map[key] = { title: meta?.content_title || key, views: 0, cta: 0, clicks: 0 };
      if (e.event_type === "view") map[key].views++;
      if (e.event_type === "cta_click") map[key].cta++;
      if (e.event_type === "click") map[key].clicks++;
    });
    return Object.values(map).sort((a, b) => b.views - a.views).slice(0, 10);
  })();

  const timeData = buildTimeChart(filtered, ["view", "cta_click", "click"]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Eye} label={`${label} Views`} value={views.length} color="text-primary" />
        <StatCard icon={MousePointerClick} label="CTA Clicks" value={ctaClicks.length} color="text-warning" />
        <StatCard icon={MousePointerClick} label="Link Clicks" value={clicks.length} color="text-success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title={`${label} Traffic (7 Days)`} icon={TrendingUp}>
          <TimeBarChart data={timeData} bars={[
            { key: "view", fill: CHART_COLORS[0], name: "Views" },
            { key: "cta_click", fill: CHART_COLORS[2], name: "CTA Clicks" },
            { key: "click", fill: CHART_COLORS[1], name: "Link Clicks" },
          ]} />
        </ChartCard>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Top {label}s
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contentBreakdown.length > 0 ? (
              <div className="space-y-3">
                {contentBreakdown.map(item => (
                  <div key={item.title} className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground truncate flex-1">{item.title}</span>
                    <Badge variant="outline" className="shrink-0">{item.views} views</Badge>
                    <Badge variant="secondary" className="shrink-0">{item.cta} CTA</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No {label.toLowerCase()} data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/* ─── Shared components ─── */
function StatCard({ icon: Icon, label, value, color = "text-primary" }: { icon: any; label: string; value: number | string; color?: string }) {
  return (
    <Card className="glass">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function TimeBarChart({ data, bars }: { data: any[]; bars: { key: string; fill: string; name: string }[] }) {
  const hasData = data.some(d => bars.some(b => d[b.key] > 0));
  if (!hasData) return <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <XAxis dataKey="day" tick={{ fill: "hsl(240, 5%, 64.9%)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "hsl(240, 5%, 64.9%)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "hsl(240, 6%, 6%)", border: "1px solid hsl(240, 4%, 16%)", borderRadius: 8, color: "hsl(0, 0%, 95%)" }} />
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} fill={b.fill} name={b.name} radius={i === bars.length - 1 ? [4, 4, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
