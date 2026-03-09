import { createContext, useContext, useState, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  brand_tone: string | null;
  brand_type: string | null;
  brand_colors: { primary: string; secondary: string } | null;
  logo_url: string | null;
  target_audience: string | null;
  created_at: string;
  updated_at: string;
}

interface CampaignContextType {
  campaigns: Campaign[];
  isLoading: boolean;
  activeCampaign: Campaign | null;
  setActiveCampaignId: (id: string | null) => void;
  createCampaign: (data: Partial<Campaign>) => Promise<Campaign>;
  updateCampaign: (id: string, data: Partial<Campaign>) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;
}

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

export function CampaignProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(
    () => localStorage.getItem("activeCampaignId")
  );

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
    enabled: !!user,
  });

  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId) ?? null;

  const handleSetActive = (id: string | null) => {
    setActiveCampaignId(id);
    if (id) localStorage.setItem("activeCampaignId", id);
    else localStorage.removeItem("activeCampaignId");
  };

  const createCampaign = async (data: Partial<Campaign>): Promise<Campaign> => {
    const { data: created, error } = await supabase
      .from("campaigns")
      .insert({ ...data, user_id: user!.id } as any)
      .select()
      .single();
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    return created as Campaign;
  };

  const updateCampaign = async (id: string, data: Partial<Campaign>) => {
    const { error } = await supabase
      .from("campaigns")
      .update(data as any)
      .eq("id", id)
      .eq("user_id", user!.id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["campaigns"] });
  };

  const deleteCampaign = async (id: string) => {
    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id)
      .eq("user_id", user!.id);
    if (error) throw error;
    if (activeCampaignId === id) handleSetActive(null);
    queryClient.invalidateQueries({ queryKey: ["campaigns"] });
  };

  return (
    <CampaignContext.Provider
      value={{
        campaigns,
        isLoading,
        activeCampaign,
        setActiveCampaignId: handleSetActive,
        createCampaign,
        updateCampaign,
        deleteCampaign,
      }}
    >
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error("useCampaign must be used within CampaignProvider");
  return ctx;
}
