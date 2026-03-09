import {
  LayoutDashboard, BookOpen, Video, Globe,
  BarChart3, Settings, Zap, Megaphone, ChevronRight,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useCampaign } from "@/contexts/CampaignContext";
import { useCredits } from "@/hooks/useProfile";
import { Progress } from "@/components/ui/progress";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Campaigns", url: "/campaigns", icon: Megaphone },
  { title: "Landing Pages", url: "/landing-pages", icon: Globe },
  { title: "Videos", url: "/videos", icon: Video },
  { title: "Blogs", url: "/blogs", icon: BookOpen },
];

const insightItems = [
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Credits", url: "/credits", icon: Zap },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { activeCampaign } = useCampaign();
  const { data: credits } = useCredits();

  const creditsLeft = credits?.credits_remaining ?? 0;
  const creditsTotal = (credits?.plans as any)?.credits_per_month ?? 50;
  const creditsPercent = Math.min((creditsLeft / creditsTotal) * 100, 100);

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/dashboard")}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary shrink-0">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-base font-semibold text-foreground tracking-tight">Marketing OS</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Active campaign pill */}
        {!collapsed && activeCampaign && (
          <div
            className="mx-3 mb-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => navigate(`/campaigns/${activeCampaign.id}`)}
          >
            <div className="flex items-center gap-2">
              {activeCampaign.logo_url ? (
                <img src={activeCampaign.logo_url} className="h-5 w-5 rounded object-cover shrink-0" alt="" />
              ) : (
                <div
                  className="h-5 w-5 rounded text-[9px] font-bold text-white flex items-center justify-center shrink-0"
                  style={{ background: (activeCampaign.brand_colors as any)?.primary || "hsl(var(--primary))" }}
                >
                  {activeCampaign.name.charAt(0)}
                </div>
              )}
              <span className="text-xs font-medium truncate flex-1">{activeCampaign.name}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end className="transition-colors" activeClassName="bg-sidebar-accent text-foreground">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Insights</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {insightItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end className="transition-colors" activeClassName="bg-sidebar-accent text-foreground">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Credits</span>
              <span className="text-xs font-medium">{creditsLeft}/{creditsTotal}</span>
            </div>
            <Progress value={creditsPercent} className="h-1" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}