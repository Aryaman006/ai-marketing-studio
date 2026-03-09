import { useCampaign } from "@/contexts/CampaignContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Megaphone } from "lucide-react";

export function CampaignSelector({ className }: { className?: string }) {
  const { campaigns, activeCampaign, setActiveCampaignId } = useCampaign();

  if (!campaigns.length) return null;

  return (
    <div className={className}>
      <Select
        value={activeCampaign?.id ?? "all"}
        onValueChange={(v) => setActiveCampaignId(v === "all" ? null : v)}
      >
        <SelectTrigger className="bg-secondary/50 border-border/50 h-9 text-sm w-[200px]">
          <div className="flex items-center gap-2 truncate">
            <Megaphone className="h-3.5 w-3.5 text-primary shrink-0" />
            <SelectValue placeholder="All Campaigns" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Campaigns</SelectItem>
          {campaigns.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <div className="flex items-center gap-2">
                {c.logo_url ? (
                  <img src={c.logo_url} className="h-4 w-4 rounded object-cover" alt="" />
                ) : (
                  <div
                    className="h-4 w-4 rounded text-[8px] font-bold text-white flex items-center justify-center"
                    style={{ background: (c.brand_colors as any)?.primary || "hsl(var(--primary))" }}
                  >
                    {c.name.charAt(0)}
                  </div>
                )}
                <span className="truncate">{c.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
