import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits, useRecentGenerations } from "@/hooks/useProfile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Loader2, FileText, Globe, Image, BookOpen, TrendingUp } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const CHART_COLORS = [
  "hsl(262, 83%, 58%)",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(200, 80%, 50%)",
];

const TYPE_LABELS: Record<string, string> = {
  post: "Social Posts",
  landing: "Landing Pages",
  asset: "Assets",
  blog: "Blog Posts",
};

export default function Credits() {
  const { user } = useAuth();
  const { data: credits, isLoading: creditsLoading } = useCredits();

  const { data: allGenerations } = useQuery({
    queryKey: ["all-generations", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("generations")
        .select("type, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const creditsMax = (credits as any)?.plans?.credits_per_month || 50;
  const creditsUsed = creditsMax - (credits?.credits_remaining || 0);
  const creditsPercent = Math.round((creditsUsed / creditsMax) * 100);

  // Usage by type
  const usageByType = (() => {
    if (!allGenerations) return [];
    const types: Record<string, number> = {};
    allGenerations.forEach(g => {
      types[g.type] = (types[g.type] || 0) + 1;
    });
    return Object.entries(types).map(([name, value]) => ({
      name: TYPE_LABELS[name] || name,
      value,
    }));
  })();

  // Usage over 7 days
  const usageOverTime = (() => {
    if (!allGenerations) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayStart = startOfDay(date);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const count = allGenerations.filter(g => {
        const d = new Date(g.created_at);
        return d >= dayStart && d < dayEnd;
      }).length;
      return { day: format(date, "EEE"), count };
    });
  })();

  // Daily breakdown by type
  const dailyByType = (() => {
    if (!allGenerations) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayStart = startOfDay(date);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayGens = allGenerations.filter(g => {
        const d = new Date(g.created_at);
        return d >= dayStart && d < dayEnd;
      });
      return {
        day: format(date, "EEE"),
        posts: dayGens.filter(g => g.type === "post").length,
        landings: dayGens.filter(g => g.type === "landing").length,
        assets: dayGens.filter(g => g.type === "asset").length,
        blogs: dayGens.filter(g => g.type === "blog").length,
      };
    });
  })();

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Credits & Usage</h1>
          <Badge variant="secondary" className="text-xs">
            {(credits as any)?.plans?.name || "Free"} Plan
          </Badge>
        </div>

        {/* Credits overview */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="glass">
            <CardContent className="p-5">
              {creditsLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-warning" />
                    <span className="text-sm font-medium text-muted-foreground">Credits Remaining</span>
                  </div>
                  <p className="text-4xl font-bold">{credits?.credits_remaining ?? 0}</p>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${100 - creditsPercent}%`,
                        background: creditsPercent > 80 ? "hsl(0, 62.8%, 50.6%)" : "hsl(262, 83%, 58%)",
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {creditsUsed} of {creditsMax} used this month
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="p-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">Total Generations</span>
                </div>
                <p className="text-4xl font-bold">{allGenerations?.length || 0}</p>
                <p className="text-xs text-muted-foreground">All time</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="p-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-success" />
                  <span className="text-sm font-medium text-muted-foreground">Plan Limits</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Posts/day</span>
                    <span className="font-medium">{(credits as any)?.plans?.max_posts_per_day || 5}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assets/day</span>
                    <span className="font-medium">{(credits as any)?.plans?.max_assets_per_day || 5}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Landings/day</span>
                    <span className="font-medium">{(credits as any)?.plans?.max_landings_per_day || 3}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Daily Usage (7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usageOverTime.some(d => d.count > 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyByType}>
                    <XAxis dataKey="day" tick={{ fill: "hsl(240, 5%, 64.9%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(240, 5%, 64.9%)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(240, 6%, 6%)", border: "1px solid hsl(240, 4%, 16%)", borderRadius: 8, color: "hsl(0, 0%, 95%)" }} />
                    <Bar dataKey="posts" stackId="a" fill={CHART_COLORS[0]} name="Posts" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="landings" stackId="a" fill={CHART_COLORS[1]} name="Landings" />
                    <Bar dataKey="assets" stackId="a" fill={CHART_COLORS[2]} name="Assets" />
                    <Bar dataKey="blogs" stackId="a" fill={CHART_COLORS[3]} name="Blogs" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No usage data yet</p>
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Usage by Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usageByType.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={usageByType} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                        {usageByType.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1">
                    {usageByType.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-2 text-sm">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground">{item.name}</span>
                        <span className="ml-auto font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No generations yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
