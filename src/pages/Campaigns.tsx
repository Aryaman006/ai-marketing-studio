import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCampaign, Campaign } from "@/contexts/CampaignContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Megaphone, Plus, Trash2, Pencil, CheckCircle, Loader2, Sparkles, Palette,
  ArrowRight, ArrowLeft, FileText, Globe, Image, BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const BRAND_TYPES = [
  { value: "tech", emoji: "💻" }, { value: "fitness", emoji: "💪" },
  { value: "ecommerce", emoji: "🛒" }, { value: "saas", emoji: "☁️" },
  { value: "agency", emoji: "🏢" }, { value: "education", emoji: "📚" },
  { value: "healthcare", emoji: "🏥" }, { value: "finance", emoji: "💰" },
  { value: "food", emoji: "🍕" }, { value: "travel", emoji: "✈️" },
  { value: "fashion", emoji: "👗" }, { value: "general", emoji: "🌐" },
];

const BRAND_TONES = [
  "professional", "fun", "luxury", "minimal", "bold", "friendly",
  "corporate", "playful", "elegant", "edgy",
];

const WIZARD_STEPS = ["basics", "brand", "visuals"] as const;
type WizardStep = typeof WIZARD_STEPS[number];

export default function Campaigns() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { campaigns, isLoading, activeCampaign, setActiveCampaignId, createCampaign, updateCampaign, deleteCampaign } = useCampaign();
  const [showCreate, setShowCreate] = useState(false);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>("basics");
  const [form, setForm] = useState({
    name: "", description: "", brand_type: "general", brand_tone: "professional",
    primary_color: "#7c3aed", secondary_color: "#a78bfa", target_audience: "", logo_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [generatingLogo, setGeneratingLogo] = useState(false);

  const resetForm = () => {
    setForm({
      name: "", description: "", brand_type: "general", brand_tone: "professional",
      primary_color: "#7c3aed", secondary_color: "#a78bfa", target_audience: "", logo_url: "",
    });
    setWizardStep("basics");
  };

  const openCreate = () => { resetForm(); setShowCreate(true); };
  const openEdit = (c: Campaign) => {
    setEditingCampaign(c);
    setWizardStep("basics");
    setForm({
      name: c.name,
      description: c.description || "",
      brand_type: c.brand_type || "general",
      brand_tone: c.brand_tone || "professional",
      primary_color: (c.brand_colors as any)?.primary || "#7c3aed",
      secondary_color: (c.brand_colors as any)?.secondary || "#a78bfa",
      target_audience: c.target_audience || "",
      logo_url: c.logo_url || "",
    });
  };

  const handleGenerateLogo = async () => {
    if (!form.name.trim()) { toast.error("Enter a campaign name first"); return; }
    setGeneratingLogo(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-asset", {
        body: {
          prompt: `Create a modern, clean logo for a ${form.brand_type} brand called "${form.name}". Use colors ${form.primary_color} and ${form.secondary_color}. Style: ${form.brand_tone}. Make it minimal and iconic.`,
          assetType: "logo",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setForm((f) => ({ ...f, logo_url: data.imageUrl }));
      toast.success("Logo generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate logo");
    } finally {
      setGeneratingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Campaign name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        brand_type: form.brand_type,
        brand_tone: form.brand_tone,
        brand_colors: { primary: form.primary_color, secondary: form.secondary_color },
        logo_url: form.logo_url || null,
        target_audience: form.target_audience.trim() || null,
      };
      if (editingCampaign) {
        await updateCampaign(editingCampaign.id, payload);
        toast.success("Campaign updated!");
        setEditingCampaign(null);
      } else {
        const created = await createCampaign(payload);
        setActiveCampaignId(created.id);
        toast.success("Campaign created! Start generating content →");
        setShowCreate(false);
      }
      resetForm();
    } catch (e: any) {
      toast.error(e.message || "Failed to save campaign");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCampaign(id);
      toast.success("Campaign deleted");
    } catch {
      toast.error("Failed to delete campaign");
    } finally {
      setDeletingCampaignId(null);
    }
  };

  const isDialogOpen = showCreate || !!editingCampaign;
  const stepIndex = WIZARD_STEPS.indexOf(wizardStep);
  const canNext = wizardStep === "basics" ? form.name.trim().length > 0 : true;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your brand campaigns and generate content</p>
          </div>
          <Button onClick={openCreate} className="gradient-primary text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" />New Campaign
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !campaigns.length ? (
          <Card className="glass border-dashed">
            <CardContent className="py-16 text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-glow">
                <Megaphone className="h-8 w-8 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Create your first campaign</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                A campaign is your brand identity. Set your tone, colors, and audience — then generate consistent content across all channels.
              </p>
              <Button onClick={openCreate} size="lg" className="gradient-primary text-primary-foreground">
                <Sparkles className="mr-2 h-4 w-4" />Create Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => {
              const colors = c.brand_colors as any;
              const isActive = activeCampaign?.id === c.id;
              return (
                <Card
                  key={c.id}
                  className={`glass cursor-pointer transition-all hover:shadow-glow group ${isActive ? "ring-2 ring-primary shadow-glow" : "hover:border-border"}`}
                  onClick={() => { setActiveCampaignId(c.id); navigate(`/campaigns/${c.id}`); }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {c.logo_url ? (
                          <img src={c.logo_url} alt={c.name} className="h-11 w-11 rounded-xl object-cover border border-border/50" />
                        ) : (
                          <div
                            className="h-11 w-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                            style={{ background: `linear-gradient(135deg, ${colors?.primary || "hsl(262, 83%, 58%)"}, ${colors?.secondary || "hsl(280, 80%, 65%)"})` }}
                          >
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{c.name}</CardTitle>
                          <p className="text-xs text-muted-foreground capitalize">{c.brand_type} · {c.brand_tone}</p>
                        </div>
                      </div>
                      {isActive && <CheckCircle className="h-5 w-5 text-primary shrink-0" />}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {c.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="h-4 w-4 rounded-full border border-border/50" style={{ background: colors?.primary }} />
                        <div className="h-4 w-4 rounded-full border border-border/50" style={{ background: colors?.secondary }} />
                      </div>
                      {c.target_audience && (
                        <Badge variant="secondary" className="text-[10px] truncate max-w-[140px]">{c.target_audience}</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border/30">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at), "MMM d, yyyy")}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingCampaignId(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Wizard Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditingCampaign(null); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                {editingCampaign ? "Edit Campaign" : "New Campaign"}
              </DialogTitle>
              <DialogDescription>
                {wizardStep === "basics" && "Name your campaign and describe what it's for."}
                {wizardStep === "brand" && "Define your brand personality and audience."}
                {wizardStep === "visuals" && "Set your brand colors and logo."}
              </DialogDescription>
            </DialogHeader>

            {/* Step indicator */}
            <div className="flex items-center gap-2 py-1">
              {WIZARD_STEPS.map((step, i) => (
                <div key={step} className="flex items-center gap-2 flex-1">
                  <div className={`h-1.5 flex-1 rounded-full transition-colors ${i <= stepIndex ? "bg-primary" : "bg-secondary"}`} />
                </div>
              ))}
            </div>

            {/* Step: Basics */}
            {wizardStep === "basics" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Campaign Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Summer Launch 2026"
                    className="bg-secondary/50 border-border/50 h-11"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="What is this campaign about?"
                    rows={2}
                    className="bg-secondary/50 border-border/50"
                  />
                </div>
              </div>
            )}

            {/* Step: Brand */}
            {wizardStep === "brand" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Brand Type</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {BRAND_TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setForm((f) => ({ ...f, brand_type: t.value }))}
                        className={`rounded-lg border p-2.5 text-center transition-all text-xs capitalize hover:border-primary/50 ${
                          form.brand_type === t.value ? "border-primary bg-primary/10 text-foreground" : "border-border/50 text-muted-foreground"
                        }`}
                      >
                        <span className="text-lg block mb-0.5">{t.emoji}</span>
                        {t.value}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <div className="flex flex-wrap gap-2">
                    {BRAND_TONES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setForm((f) => ({ ...f, brand_tone: t }))}
                        className={`rounded-full px-3 py-1.5 text-xs capitalize border transition-all ${
                          form.brand_tone === t ? "border-primary bg-primary/10 text-foreground" : "border-border/50 text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Target Audience <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    value={form.target_audience}
                    onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))}
                    placeholder="e.g. Small business owners, tech startups"
                    className="bg-secondary/50 border-border/50"
                  />
                </div>
              </div>
            )}

            {/* Step: Visuals */}
            {wizardStep === "visuals" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Palette className="h-4 w-4" />Brand Colors</Label>
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-3">
                        <input type="color" value={form.primary_color} onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} className="h-10 w-14 rounded-lg border border-border/50 cursor-pointer" />
                        <div>
                          <p className="text-xs font-medium">Primary</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{form.primary_color}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-3">
                        <input type="color" value={form.secondary_color} onChange={(e) => setForm((f) => ({ ...f, secondary_color: e.target.value }))} className="h-10 w-14 rounded-lg border border-border/50 cursor-pointer" />
                        <div>
                          <p className="text-xs font-medium">Secondary</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{form.secondary_color}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Preview swatch */}
                  <div className="h-8 rounded-lg overflow-hidden flex">
                    <div className="flex-1" style={{ background: form.primary_color }} />
                    <div className="flex-1" style={{ background: form.secondary_color }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 rounded-xl border border-border/50 bg-secondary/30 flex items-center justify-center overflow-hidden shrink-0">
                      {form.logo_url ? (
                        <img src={form.logo_url} alt="Logo" className="h-full w-full object-cover" />
                      ) : (
                        <div
                          className="h-full w-full flex items-center justify-center text-white font-bold text-xl"
                          style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})` }}
                        >
                          {form.name.charAt(0) || "?"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input
                        value={form.logo_url}
                        onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                        placeholder="Paste logo URL"
                        className="bg-secondary/50 border-border/50 text-xs h-9"
                      />
                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleGenerateLogo} disabled={generatingLogo}>
                        {generatingLogo ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Generating…</> : <><Sparkles className="mr-2 h-3 w-3" />Generate with AI</>}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (stepIndex === 0) { setShowCreate(false); setEditingCampaign(null); }
                  else setWizardStep(WIZARD_STEPS[stepIndex - 1]);
                }}
              >
                {stepIndex === 0 ? "Cancel" : <><ArrowLeft className="mr-1 h-3.5 w-3.5" />Back</>}
              </Button>
              {stepIndex < WIZARD_STEPS.length - 1 ? (
                <Button
                  onClick={() => setWizardStep(WIZARD_STEPS[stepIndex + 1])}
                  disabled={!canNext}
                  className="gradient-primary text-primary-foreground"
                >
                  Next<ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={saving} className="gradient-primary text-primary-foreground">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingCampaign ? "Save Changes" : "Create Campaign"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingCampaignId} onOpenChange={(o) => { if (!o) setDeletingCampaignId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the campaign and all its associated settings. Generated content (posts, landing pages, assets) will remain but won't be linked to a campaign.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deletingCampaignId && handleDelete(deletingCampaignId)}
              >
                Delete Campaign
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
