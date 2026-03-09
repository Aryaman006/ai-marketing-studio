import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campaign } from "@/contexts/CampaignContext";

interface Props {
  campaign: Campaign;
  children: ReactNode;
}

export function CampaignLayout({ campaign, children }: Props) {
  const navigate = useNavigate();
  const colors = campaign.brand_colors as any;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 items-center gap-3 border-b border-border/50 bg-card/50 px-4 backdrop-blur-sm shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/campaigns")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2.5">
          {campaign.logo_url ? (
            <img src={campaign.logo_url} alt="" className="h-7 w-7 rounded-lg object-cover border border-border/50" />
          ) : (
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
              style={{ background: `linear-gradient(135deg, ${colors?.primary || "hsl(var(--primary))"}, ${colors?.secondary || "hsl(var(--primary))"})` }}
            >
              {campaign.name.charAt(0)}
            </div>
          )}
          <span className="font-semibold text-sm">{campaign.name}</span>
          <span className="text-xs text-muted-foreground capitalize">· {campaign.brand_type}</span>
        </div>
      </header>
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
