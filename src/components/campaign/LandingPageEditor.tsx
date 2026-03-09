import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Campaign } from "@/contexts/CampaignContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Save, Loader2, Eye, Code, Type, Image, Link, Palette,
  Sparkles, Wand2, RotateCcw, MessageSquare, Upload, FileText, X,
} from "lucide-react";
import { toast } from "sonner";

type LandingPage = {
  id: string; title: string | null; topic: string | null; slug: string | null;
  html_content: string | null; is_public: boolean; created_at: string; updated_at: string;
  user_id: string; campaign_id?: string | null;
};

interface Props {
  page: LandingPage;
  campaign: Campaign;
  onBack: () => void;
  onSaved: () => void;
}

type EditMode = "visual" | "code";

interface SelectedElement {
  tagName: string;
  text: string;
  href?: string;
  src?: string;
  backgroundColor?: string;
  color?: string;
  selector: string;
  outerHtml?: string;
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return "#000000";
  const r = parseInt(match[0]);
  const g = parseInt(match[1]);
  const b = parseInt(match[2]);
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function uploadFileToStorage(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/landing-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("assets").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
  return urlData.publicUrl;
}

export function LandingPageEditor({ page, campaign, onBack, onSaved }: Props) {
  const { user } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const [html, setHtml] = useState(page.html_content ?? "");
  const [title, setTitle] = useState(page.title ?? "");
  const [mode, setMode] = useState<EditMode>("visual");
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [editText, setEditText] = useState("");
  const [editHref, setEditHref] = useState("");
  const [editSrc, setEditSrc] = useState("");
  const [editBg, setEditBg] = useState("");
  const [editColor, setEditColor] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  // AI editing state
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiSectionInstruction, setAiSectionInstruction] = useState("");
  const [htmlHistory, setHtmlHistory] = useState<string[]>([]);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiFileContent, setAiFileContent] = useState<string | null>(null);

  const pushHistory = useCallback(() => {
    setHtmlHistory((prev) => [...prev.slice(-9), html]);
  }, [html]);

  const undo = useCallback(() => {
    setHtmlHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setHtml(last);
      return prev.slice(0, -1);
    });
  }, []);

  // Handle AI file attachment
  const handleAiFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const isText = file.type.startsWith("text/") || 
      [".txt", ".md", ".csv", ".json", ".html", ".css"].some(ext => file.name.endsWith(ext));
    
    try {
      if (isText) {
        const text = await readFileAsText(file);
        setAiFileContent(text.slice(0, 30000));
      } else {
        // For PDF/Word/images, read as base64 for AI
        const base64 = await fileToBase64(file);
        setAiFileContent(base64.slice(0, 50000));
      }
      setAiFile(file);
    } catch {
      toast.error("Failed to read file");
    }
    e.target.value = "";
  }, []);

  // Handle manual image upload for selected element
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setUploadingImage(true);
    try {
      const url = await uploadFileToStorage(file, user.id);
      setEditSrc(url);
      toast.success("Image uploaded!");
    } catch (err: any) {
      toast.error("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }, [user]);

  // Inject click handler into iframe
  const setupIframeListeners = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    const doc = iframe.contentDocument;

    const style = doc.createElement("style");
    style.textContent = `
      * { cursor: pointer !important; }
      *:hover { outline: 2px dashed rgba(124, 58, 237, 0.5) !important; outline-offset: 2px; }
      .lp-selected { outline: 2px solid rgba(124, 58, 237, 1) !important; outline-offset: 2px; }
    `;
    doc.head.appendChild(style);

    doc.body.addEventListener("click", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = e.target as HTMLElement;

      doc.querySelectorAll(".lp-selected").forEach((s) => s.classList.remove("lp-selected"));
      el.classList.add("lp-selected");

      const path: string[] = [];
      let current: HTMLElement | null = el;
      while (current && current !== doc.body) {
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children);
          const index = siblings.indexOf(current);
          path.unshift(`${current.tagName.toLowerCase()}:nth-child(${index + 1})`);
        }
        current = parent;
      }
      const selector = path.join(" > ");
      const computed = doc.defaultView?.getComputedStyle(el);

      setSelected({
        tagName: el.tagName.toLowerCase(),
        text: el.innerText?.slice(0, 500) || "",
        href: el.tagName === "A" ? (el as HTMLAnchorElement).href : undefined,
        src: el.tagName === "IMG" ? (el as HTMLImageElement).src : undefined,
        backgroundColor: computed?.backgroundColor || "",
        color: computed?.color || "",
        selector,
        outerHtml: el.outerHTML?.slice(0, 2000) || "",
      });
      setEditText(el.innerText?.slice(0, 500) || "");
      setEditHref(el.tagName === "A" ? (el as HTMLAnchorElement).getAttribute("href") || "" : "");
      setEditSrc(el.tagName === "IMG" ? (el as HTMLImageElement).getAttribute("src") || "" : "");
      setEditBg(rgbToHex(computed?.backgroundColor || ""));
      setEditColor(rgbToHex(computed?.color || ""));
      setAiSectionInstruction("");
    });
  }, []);

  const handleIframeLoad = useCallback(() => {
    if (mode === "visual") {
      setTimeout(setupIframeListeners, 100);
    }
  }, [mode, setupIframeListeners]);

  // Apply manual edits
  const applyEdit = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument || !selected) return;
    const doc = iframe.contentDocument;
    pushHistory();

    try {
      const el = doc.querySelector(`body > ${selected.selector}`) as HTMLElement;
      if (!el) { toast.error("Element not found"); return; }

      if (editText !== selected.text) {
        if (el.children.length === 0) {
          el.innerText = editText;
        } else {
          const textNodes = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent?.trim());
          if (textNodes.length) {
            textNodes[0].textContent = editText;
          } else {
            el.innerText = editText;
          }
        }
      }

      if (selected.tagName === "a" && editHref !== selected.href) {
        (el as HTMLAnchorElement).setAttribute("href", editHref);
      }
      if (selected.tagName === "img" && editSrc !== selected.src) {
        (el as HTMLImageElement).setAttribute("src", editSrc);
      }
      if (editBg) el.style.backgroundColor = editBg;
      if (editColor) el.style.color = editColor;

      const serialized = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
      setHtml(serialized);
      setSelected(null);
      toast.success("Edit applied!");
    } catch {
      toast.error("Failed to apply edit");
    }
  }, [selected, editText, editHref, editSrc, editBg, editColor, pushHistory]);

  // AI: Edit entire page
  const aiFullPageMutation = useMutation({
    mutationFn: async () => {
      if (!aiInstruction.trim()) throw new Error("Enter an instruction");
      pushHistory();

      const { data, error } = await supabase.functions.invoke("edit-landing-ai", {
        body: {
          instruction: aiInstruction.trim(),
          currentHtml: html.slice(0, 80000),
          fileContent: aiFileContent?.slice(0, 15000) || undefined,
          fileName: aiFile?.name || undefined,
          brandTone: campaign.brand_tone,
          brandType: campaign.brand_type,
          brandColors: campaign.brand_colors,
          targetAudience: campaign.target_audience,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.html as string;
    },
    onSuccess: (newHtml) => {
      setHtml(newHtml);
      setAiInstruction("");
      setAiFile(null);
      setAiFileContent(null);
      toast.success("AI edits applied!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // AI: Edit selected section
  const aiSectionMutation = useMutation({
    mutationFn: async () => {
      if (!aiSectionInstruction.trim() || !selected) throw new Error("Select an element and enter an instruction");
      pushHistory();

      const { data, error } = await supabase.functions.invoke("edit-landing-ai", {
        body: {
          instruction: aiSectionInstruction.trim(),
          currentHtml: html.slice(0, 80000),
          selectedElement: selected.outerHtml,
          selectedSelector: selected.selector,
          brandTone: campaign.brand_tone,
          brandType: campaign.brand_type,
          brandColors: campaign.brand_colors,
          targetAudience: campaign.target_audience,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.html as string;
    },
    onSuccess: (newHtml) => {
      setHtml(newHtml);
      setAiSectionInstruction("");
      setSelected(null);
      toast.success("AI section edit applied!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("landing_pages")
        .update({ title: title.trim() || page.title, html_content: html })
        .eq("id", page.id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Landing page saved!");
      onSaved();
    },
    onError: () => toast.error("Failed to save"),
  });

  const isAiWorking = aiFullPageMutation.isPending || aiSectionMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.html" className="hidden" onChange={handleAiFileSelect} />
      <input ref={aiFileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.html,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleAiFileSelect} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold bg-transparent border-none h-auto p-0 focus-visible:ring-0"
            placeholder="Page title..."
          />
        </div>
        <div className="flex items-center gap-2">
          {htmlHistory.length > 0 && (
            <Button variant="outline" size="sm" onClick={undo}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />Undo
            </Button>
          )}
          <Button
            variant={mode === "visual" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("visual"); setSelected(null); }}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />Visual
          </Button>
          <Button
            variant={mode === "code" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("code"); setSelected(null); }}
          >
            <Code className="h-3.5 w-3.5 mr-1" />Code
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gradient-primary text-primary-foreground"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      {/* AI Full Page Bar with file upload */}
      <Card className="glass border-primary/20">
        <CardContent className="py-3 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <Input
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              placeholder="Ask AI to edit… e.g. 'Add a pricing table' or 'Apply changes from the uploaded file'"
              className="bg-secondary/50 border-border/50 text-sm"
              onKeyDown={(e) => e.key === "Enter" && aiInstruction.trim() && !isAiWorking && aiFullPageMutation.mutate()}
              disabled={isAiWorking}
            />
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => aiFileInputRef.current?.click()}
              disabled={isAiWorking}
              title="Attach file (PDF, Word, image, text)"
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => aiFullPageMutation.mutate()}
              disabled={isAiWorking || !aiInstruction.trim()}
              size="sm"
              className="gradient-primary text-primary-foreground shrink-0"
            >
              {aiFullPageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            </Button>
          </div>
          {aiFile && (
            <div className="flex items-center gap-2 px-1">
              <Badge variant="secondary" className="text-xs gap-1.5">
                <FileText className="h-3 w-3" />
                {aiFile.name}
                <button onClick={() => { setAiFile(null); setAiFileContent(null); }} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
              <span className="text-[10px] text-muted-foreground">AI will use this file to apply changes</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Main area */}
        <Card className="glass overflow-hidden relative">
          {isAiWorking && (
            <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-sm flex items-center justify-center">
              <div className="flex items-center gap-3 bg-card px-6 py-4 rounded-xl shadow-lg border border-border/50">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium">AI is editing…</span>
              </div>
            </div>
          )}
          {mode === "visual" ? (
            <iframe
              ref={iframeRef}
              srcDoc={html}
              className="w-full h-[600px] bg-white"
              sandbox="allow-scripts allow-same-origin"
              title="Landing page editor"
              onLoad={handleIframeLoad}
            />
          ) : (
            <Textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              className="font-mono text-xs min-h-[600px] border-none rounded-none bg-secondary/20"
            />
          )}
        </Card>

        {/* Right panel */}
        {mode === "visual" && (
          <div className="space-y-4">
            {selected ? (
              <Card className="glass">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Type className="h-4 w-4 text-primary" />
                      Edit: &lt;{selected.tagName}&gt;
                    </span>
                    <Badge variant="secondary" className="text-[10px]">Selected</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Tabs defaultValue="manual" className="w-full">
                    <TabsList className="w-full rounded-none bg-secondary/30 border-y border-border/30">
                      <TabsTrigger value="manual" className="gap-1 text-xs flex-1">
                        <Palette className="h-3 w-3" />Manual
                      </TabsTrigger>
                      <TabsTrigger value="ai" className="gap-1 text-xs flex-1">
                        <Sparkles className="h-3 w-3" />AI Edit
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="manual" className="p-4 space-y-3 mt-0">
                      {/* Text */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Text Content</Label>
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={3}
                          className="bg-secondary/50 border-border/50 text-xs"
                        />
                      </div>

                      {/* Link */}
                      {selected.tagName === "a" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1"><Link className="h-3 w-3" />Link URL</Label>
                          <Input
                            value={editHref}
                            onChange={(e) => setEditHref(e.target.value)}
                            placeholder="https://..."
                            className="bg-secondary/50 border-border/50 text-xs"
                          />
                        </div>
                      )}

                      {/* Image - URL + Upload */}
                      {selected.tagName === "img" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1"><Image className="h-3 w-3" />Image</Label>
                          <Input
                            value={editSrc}
                            onChange={(e) => setEditSrc(e.target.value)}
                            placeholder="https://... or upload below"
                            className="bg-secondary/50 border-border/50 text-xs"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs gap-1.5"
                            onClick={() => imageInputRef.current?.click()}
                            disabled={uploadingImage}
                          >
                            {uploadingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                            {uploadingImage ? "Uploading…" : "Upload Image"}
                          </Button>
                          {editSrc && (
                            <img src={editSrc} alt="Preview" className="w-full h-20 object-cover rounded border border-border/50" />
                          )}
                        </div>
                      )}

                      {/* Any element - replace with uploaded image */}
                      {selected.tagName !== "img" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1"><Image className="h-3 w-3" />Background Image</Label>
                          <Input
                            value={editSrc}
                            onChange={(e) => setEditSrc(e.target.value)}
                            placeholder="Image URL for background..."
                            className="bg-secondary/50 border-border/50 text-xs"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs gap-1.5"
                            onClick={() => imageInputRef.current?.click()}
                            disabled={uploadingImage}
                          >
                            {uploadingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                            {uploadingImage ? "Uploading…" : "Upload & Set as Background"}
                          </Button>
                        </div>
                      )}

                      {/* Colors */}
                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1"><Palette className="h-3 w-3" />Colors</Label>
                        <div className="flex gap-3">
                          <div className="flex items-center gap-2">
                            <input type="color" value={editBg || "#ffffff"} onChange={(e) => setEditBg(e.target.value)} className="h-8 w-10 rounded border border-border/50 cursor-pointer" />
                            <span className="text-[10px] text-muted-foreground">BG</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="color" value={editColor || "#000000"} onChange={(e) => setEditColor(e.target.value)} className="h-8 w-10 rounded border border-border/50 cursor-pointer" />
                            <span className="text-[10px] text-muted-foreground">Text</span>
                          </div>
                        </div>
                      </div>

                      <Button onClick={() => {
                        // For non-img elements with background image
                        if (selected.tagName !== "img" && editSrc) {
                          const iframe = iframeRef.current;
                          if (iframe?.contentDocument) {
                            pushHistory();
                            const doc = iframe.contentDocument;
                            const el = doc.querySelector(`body > ${selected.selector}`) as HTMLElement;
                            if (el) {
                              el.style.backgroundImage = `url('${editSrc}')`;
                              el.style.backgroundSize = "cover";
                              el.style.backgroundPosition = "center";
                            }
                          }
                        }
                        applyEdit();
                      }} className="w-full gradient-primary text-primary-foreground" size="sm">
                        Apply Changes
                      </Button>
                    </TabsContent>

                    <TabsContent value="ai" className="p-4 space-y-3 mt-0">
                      <div className="rounded-lg border border-primary/10 bg-primary/5 p-2.5 text-xs text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5 text-primary inline mr-1.5" />
                        Describe how to change this <strong>&lt;{selected.tagName}&gt;</strong> element
                      </div>
                      <Textarea
                        value={aiSectionInstruction}
                        onChange={(e) => setAiSectionInstruction(e.target.value)}
                        placeholder={`e.g. "Make the text more compelling" or "Change to a gradient background"`}
                        rows={3}
                        className="bg-secondary/50 border-border/50 text-xs"
                        disabled={aiSectionMutation.isPending}
                      />
                      <Button
                        onClick={() => aiSectionMutation.mutate()}
                        disabled={aiSectionMutation.isPending || !aiSectionInstruction.trim()}
                        className="w-full gradient-primary text-primary-foreground"
                        size="sm"
                      >
                        {aiSectionMutation.isPending ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Editing…</>
                        ) : (
                          <><Wand2 className="h-3.5 w-3.5 mr-1.5" />Apply AI Edit</>
                        )}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card className="glass">
                <CardContent className="py-8 text-center">
                  <Eye className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Click any element to edit manually or with AI</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Or use the AI bar above for full-page edits</p>
                </CardContent>
              </Card>
            )}

            {/* Quick AI actions */}
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />Quick AI Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {[
                  "Improve the hero section copy",
                  "Make the design more modern",
                  "Add a testimonials section",
                  "Improve mobile responsiveness",
                  "Add a FAQ section",
                  "Make colors more vibrant",
                ].map((action) => (
                  <Button
                    key={action}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-8 text-muted-foreground hover:text-foreground"
                    disabled={isAiWorking}
                    onClick={() => {
                      setAiInstruction(action);
                      pushHistory();
                      supabase.functions.invoke("edit-landing-ai", {
                        body: {
                          instruction: action,
                          currentHtml: html.slice(0, 80000),
                          brandTone: campaign.brand_tone,
                          brandType: campaign.brand_type,
                          brandColors: campaign.brand_colors,
                          targetAudience: campaign.target_audience,
                        },
                      }).then(({ data, error }) => {
                        if (error || data?.error) {
                          toast.error(data?.error || "AI edit failed");
                          return;
                        }
                        setHtml(data.html || "");
                        setAiInstruction("");
                        toast.success("AI edits applied!");
                      });
                    }}
                  >
                    <Wand2 className="h-3 w-3 mr-2 text-primary" />{action}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
