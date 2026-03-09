import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, useCredits } from "@/hooks/useProfile";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Globe, CreditCard, LogOut, Trash2, Plus, Loader2, X, User, Shield,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: credits } = useCredits();
  const queryClient = useQueryClient();
  const [newDomain, setNewDomain] = useState("");

  const { data: domains, isLoading: domainsLoading } = useQuery({
    queryKey: ["domains", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("domains").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addDomainMutation = useMutation({
    mutationFn: async (domainName: string) => {
      const { error } = await supabase.from("domains").insert({ domain_name: domainName, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Domain added"); setNewDomain(""); queryClient.invalidateQueries({ queryKey: ["domains"] }); },
    onError: () => toast.error("Failed to add domain"),
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("domains").delete().eq("id", id).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Domain removed"); queryClient.invalidateQueries({ queryKey: ["domains"] }); },
    onError: () => toast.error("Failed to remove domain"),
  });

  const handleAddDomain = () => {
    const cleaned = newDomain.trim().toLowerCase();
    if (!cleaned) return;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(cleaned)) {
      toast.error("Please enter a valid domain name"); return;
    }
    addDomainMutation.mutate(cleaned);
  };

  const plan = (credits as any)?.plans;
  const creditsLeft = credits?.credits_remaining ?? 0;
  const creditsTotal = plan?.credits_per_month ?? 50;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your account, domains, and billing</p>
        </div>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList>
            <TabsTrigger value="account" className="gap-1.5"><User className="h-3.5 w-3.5" />Account</TabsTrigger>
            <TabsTrigger value="domains" className="gap-1.5"><Globe className="h-3.5 w-3.5" />Domains</TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" />Billing</TabsTrigger>
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-4">
            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={profile?.avatar_url ?? ""} />
                    <AvatarFallback className="bg-primary/20 text-primary text-lg">
                      {(profile?.full_name ?? user?.email ?? "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold">{profile?.full_name || "User"}</h2>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <Badge variant="outline" className="mt-1 text-xs border-primary/30 text-primary">{plan?.name || "Free"} Plan</Badge>
                  </div>
                  <Button variant="outline" size="sm" onClick={signOut}>
                    <LogOut className="mr-2 h-3.5 w-3.5" />Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-destructive/20">
              <CardHeader>
                <CardTitle className="text-sm text-destructive flex items-center gap-2">
                  <Shield className="h-4 w-4" />Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                      <Trash2 className="mr-2 h-3.5 w-3.5" />Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. All your data will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => toast.info("Account deletion is not yet available. Contact support.")}
                      >Delete Account</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Domains Tab */}
          <TabsContent value="domains" className="space-y-4">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-base">Custom Domains</CardTitle>
                <CardDescription>Connect domains for blogs and landing pages.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="example.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
                    className="flex-1 bg-secondary/50 border-border/50"
                  />
                  <Button onClick={handleAddDomain} disabled={addDomainMutation.isPending || !newDomain.trim()} className="gradient-primary text-primary-foreground">
                    {addDomainMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    <span className="ml-2 hidden sm:inline">Add</span>
                  </Button>
                </div>

                {domainsLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                ) : !domains?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No custom domains yet.</p>
                ) : (
                  <div className="space-y-2">
                    {domains.map((domain) => (
                      <div key={domain.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{domain.domain_name}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteDomainMutation.mutate(domain.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">After adding a domain, point its DNS A record to your hosting provider.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-4">
            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{plan?.name || "Free"} Plan</h3>
                    <p className="text-sm text-muted-foreground">{plan?.price ? `$${plan.price}/month` : "Free forever"}</p>
                  </div>
                  <Button variant="outline" size="sm" disabled>Upgrade</Button>
                </div>
                <Separator className="mb-4" />
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">Credits</span>
                      <span className="font-medium">{creditsLeft} / {creditsTotal}</span>
                    </div>
                    <Progress value={Math.min((creditsLeft / creditsTotal) * 100, 100)} className="h-2" />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3 mt-4">
                    <div className="rounded-lg bg-secondary/30 p-3 text-center">
                      <p className="text-xl font-bold">{plan?.max_posts_per_day ?? 5}</p>
                      <p className="text-xs text-muted-foreground">Posts/day</p>
                    </div>
                    <div className="rounded-lg bg-secondary/30 p-3 text-center">
                      <p className="text-xl font-bold">{plan?.max_assets_per_day ?? 5}</p>
                      <p className="text-xs text-muted-foreground">Assets/day</p>
                    </div>
                    <div className="rounded-lg bg-secondary/30 p-3 text-center">
                      <p className="text-xl font-bold">{plan?.max_landings_per_day ?? 3}</p>
                      <p className="text-xs text-muted-foreground">Landings/day</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
