import { LayoutDashboard, Megaphone, Globe, BookOpen, BarChart3 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Campaigns", icon: Megaphone, path: "/campaigns" },
  { label: "Pages", icon: Globe, path: "/landing-pages" },
  { label: "Blogs", icon: BookOpen, path: "/blogs" },
  { label: "Analytics", icon: BarChart3, path: "/analytics" },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-xl safe-bottom md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_6px_hsl(262_83%_58%/0.5)]")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
