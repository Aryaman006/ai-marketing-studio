import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Pencil, Type, Palette, Download, RefreshCw, Code, Eye,
  RotateCw, FlipHorizontal, FlipVertical, Crop, SlidersHorizontal,
  Square, Circle, Undo2, MousePointer,
} from "lucide-react";
import { toast } from "sonner";

interface AssetEditorProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  svgContent?: string | null;
  title: string;
  onRegenerate: (instruction: string) => Promise<void>;
  isRegenerating: boolean;
  onSaveEdited?: (dataUrl: string) => void;
}

type DrawTool = "select" | "text" | "rect" | "circle" | "draw";

interface TextOverlay {
  id: string; text: string; x: number; y: number;
  fontSize: number; color: string; fontWeight: string;
}

interface ShapeOverlay {
  id: string; type: "rect" | "circle";
  x: number; y: number; w: number; h: number;
  fill: string; opacity: number;
}

export default function AssetEditor({
  open, onClose, imageUrl, svgContent, title, onRegenerate, isRegenerating, onSaveEdited,
}: AssetEditorProps) {
  const [editInstruction, setEditInstruction] = useState("");
  const [editedSvg, setEditedSvg] = useState(svgContent || "");
  const [svgView, setSvgView] = useState<"visual" | "code">("visual");
  const [editorTab, setEditorTab] = useState<"manual" | "ai">("manual");

  // Canvas manual editing
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<DrawTool>("select");
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [shapeOverlays, setShapeOverlays] = useState<ShapeOverlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  // Tool settings
  const [drawColor, setDrawColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState(32);
  const [fontWeight, setFontWeight] = useState("bold");
  const [newText, setNewText] = useState("Your Text");
  const [shapeOpacity, setShapeOpacity] = useState(80);

  // Image adjustments
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  // Undo history
  const [history, setHistory] = useState<{ texts: TextOverlay[]; shapes: ShapeOverlay[] }[]>([]);

  const isSvg = !!svgContent;

  useEffect(() => {
    setEditedSvg(svgContent || "");
    setEditInstruction("");
    setTextOverlays([]);
    setShapeOverlays([]);
    setBrightness(100);
    setContrast(100);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setHistory([]);
    setImgLoaded(false);
    setEditorTab("manual");
  }, [svgContent, imageUrl, open]);

  // Load image for canvas
  useEffect(() => {
    if (isSvg || !imageUrl || !open) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.onerror = () => setImgLoaded(false);
    img.src = imageUrl;
  }, [imageUrl, open, isSvg]);

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    canvas.width = w;
    canvas.height = h;

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();

    // Draw shapes
    ctx.save();
    for (const shape of shapeOverlays) {
      ctx.globalAlpha = shape.opacity / 100;
      ctx.fillStyle = shape.fill;
      if (shape.type === "rect") {
        ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
      } else {
        ctx.beginPath();
        ctx.ellipse(shape.x + shape.w / 2, shape.y + shape.h / 2, shape.w / 2, shape.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (selectedOverlayId === shape.id) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#7c3aed";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(shape.x - 2, shape.y - 2, shape.w + 4, shape.h + 4);
        ctx.setLineDash([]);
      }
    }
    ctx.restore();

    // Draw text overlays
    for (const t of textOverlays) {
      ctx.save();
      ctx.font = `${t.fontWeight} ${t.fontSize}px Inter, Arial, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.textBaseline = "top";
      ctx.fillText(t.text, t.x, t.y);
      if (selectedOverlayId === t.id) {
        const metrics = ctx.measureText(t.text);
        ctx.strokeStyle = "#7c3aed";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(t.x - 4, t.y - 4, metrics.width + 8, t.fontSize + 8);
        ctx.setLineDash([]);
      }
      ctx.restore();
    }
  }, [brightness, contrast, rotation, flipH, flipV, textOverlays, shapeOverlays, selectedOverlayId]);

  useEffect(() => {
    if (imgLoaded) renderCanvas();
  }, [imgLoaded, renderCanvas]);

  const pushHistory = () => {
    setHistory((prev) => [...prev.slice(-19), { texts: [...textOverlays], shapes: [...shapeOverlays] }]);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (last) {
      setTextOverlays(last.texts);
      setShapeOverlays(last.shapes);
      setHistory((prev) => prev.slice(0, -1));
    }
  };

  const addTextOverlay = () => {
    pushHistory();
    const id = crypto.randomUUID();
    setTextOverlays((prev) => [...prev, {
      id, text: newText, x: 40, y: 40, fontSize, color: drawColor, fontWeight,
    }]);
    setSelectedOverlayId(id);
  };

  const addShape = (type: "rect" | "circle") => {
    pushHistory();
    const id = crypto.randomUUID();
    setShapeOverlays((prev) => [...prev, {
      id, type, x: 40, y: 40, w: 200, h: type === "circle" ? 200 : 80,
      fill: drawColor, opacity: shapeOpacity,
    }]);
    setSelectedOverlayId(id);
  };

  const updateSelectedText = (key: keyof TextOverlay, value: any) => {
    setTextOverlays((prev) => prev.map((t) => t.id === selectedOverlayId ? { ...t, [key]: value } : t));
  };

  const updateSelectedShape = (key: keyof ShapeOverlay, value: any) => {
    setShapeOverlays((prev) => prev.map((s) => s.id === selectedOverlayId ? { ...s, [key]: value } : s));
  };

  const deleteSelected = () => {
    if (!selectedOverlayId) return;
    pushHistory();
    setTextOverlays((prev) => prev.filter((t) => t.id !== selectedOverlayId));
    setShapeOverlays((prev) => prev.filter((s) => s.id !== selectedOverlayId));
    setSelectedOverlayId(null);
  };

  // Handle canvas click to select / place overlay
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check if clicked on existing overlay
    for (const t of [...textOverlays].reverse()) {
      if (x >= t.x && x <= t.x + 300 && y >= t.y && y <= t.y + t.fontSize + 10) {
        setSelectedOverlayId(t.id);
        setTool("select");
        return;
      }
    }
    for (const s of [...shapeOverlays].reverse()) {
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
        setSelectedOverlayId(s.id);
        setTool("select");
        return;
      }
    }

    if (tool === "text") {
      pushHistory();
      const id = crypto.randomUUID();
      setTextOverlays((prev) => [...prev, { id, text: newText, x, y, fontSize, color: drawColor, fontWeight }]);
      setSelectedOverlayId(id);
    } else if (tool === "rect") {
      addShape("rect");
    } else if (tool === "circle") {
      addShape("circle");
    } else {
      setSelectedOverlayId(null);
    }
  };

  const exportCanvas = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL("image/png");
  };

  const downloadAsset = () => {
    try {
      if (isSvg) {
        const blob = new Blob([editedSvg], { type: "image/svg+xml" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${title || "asset"}.svg`;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        const dataUrl = exportCanvas();
        const a = document.createElement("a");
        a.href = dataUrl || imageUrl;
        a.download = `${title || "asset"}.png`;
        a.click();
      }
    } catch {
      toast.error("Failed to download");
    }
  };

  const handleSaveEdited = () => {
    if (onSaveEdited && !isSvg) {
      const dataUrl = exportCanvas();
      if (dataUrl) {
        onSaveEdited(dataUrl);
        toast.success("Edits saved!");
      }
    }
  };

  // SVG helpers
  const handleSvgTextEdit = (oldText: string, newText: string) => {
    setEditedSvg((prev) => prev.replace(oldText, newText));
  };
  const handleSvgColorEdit = (oldColor: string, newColor: string) => {
    setEditedSvg((prev) => prev.split(oldColor).join(newColor));
  };
  const extractTexts = (svg: string): string[] => {
    const matches = svg.match(/>([^<]{2,})</g) || [];
    return [...new Set(matches.map((m) => m.slice(1, -1).trim()).filter((t) => t.length > 1 && t.length < 200))];
  };
  const extractColors = (svg: string): string[] => {
    const hexMatches = svg.match(/#[0-9a-fA-F]{3,8}/g) || [];
    const rgbMatches = svg.match(/rgb\([^)]+\)/g) || [];
    return [...new Set([...hexMatches, ...rgbMatches])].slice(0, 12);
  };

  const texts = isSvg ? extractTexts(editedSvg) : [];
  const colors = isSvg ? extractColors(editedSvg) : [];
  const selectedText = textOverlays.find((t) => t.id === selectedOverlayId);
  const selectedShape = shapeOverlays.find((s) => s.id === selectedOverlayId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pencil className="h-4 w-4 text-primary" />
            Edit — {title || "Untitled"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row gap-0 min-h-[400px]">
          {/* Canvas / Preview area */}
          <div className="flex-1 p-4 flex items-center justify-center bg-muted/5 border-b lg:border-b-0 lg:border-r border-border/30 min-h-[300px]">
            {isSvg ? (
              <div className="w-full space-y-2">
                {svgView === "visual" ? (
                  <div
                    className="w-full flex items-center justify-center p-4 min-h-[200px] max-h-[350px] overflow-auto"
                    dangerouslySetInnerHTML={{ __html: editedSvg }}
                  />
                ) : (
                  <Textarea
                    value={editedSvg}
                    onChange={(e) => setEditedSvg(e.target.value)}
                    rows={14}
                    className="font-mono text-xs bg-secondary/30 border-0 rounded-none"
                  />
                )}
                <div className="flex justify-center gap-1">
                  <Button variant={svgView === "visual" ? "default" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setSvgView("visual")}>
                    <Eye className="h-3 w-3 mr-1" />Visual
                  </Button>
                  <Button variant={svgView === "code" ? "default" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setSvgView("code")}>
                    <Code className="h-3 w-3 mr-1" />Code
                  </Button>
                </div>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="max-w-full max-h-[400px] rounded-md cursor-crosshair shadow-md"
                style={{ imageRendering: "auto" }}
              />
            )}
          </div>

          {/* Right panel — tools */}
          <div className="w-full lg:w-[280px] p-3 space-y-3 overflow-y-auto max-h-[400px] lg:max-h-none">
            {isSvg ? (
              /* SVG editing tools */
              <Tabs defaultValue="text" className="w-full">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="text" className="text-xs"><Type className="h-3 w-3 mr-1" />Text</TabsTrigger>
                  <TabsTrigger value="colors" className="text-xs"><Palette className="h-3 w-3 mr-1" />Colors</TabsTrigger>
                </TabsList>
                <TabsContent value="text" className="max-h-[200px] overflow-y-auto space-y-2 mt-2">
                  {texts.map((text, i) => (
                    <Input key={i} defaultValue={text} className="text-xs bg-secondary/30 border-border/30 h-8"
                      onBlur={(e) => { if (e.target.value !== text) handleSvgTextEdit(text, e.target.value); }} />
                  ))}
                  {texts.length === 0 && <p className="text-xs text-muted-foreground">No editable text found</p>}
                </TabsContent>
                <TabsContent value="colors" className="mt-2">
                  <div className="flex flex-wrap gap-2">
                    {colors.map((color, i) => (
                      <label key={i} className="relative cursor-pointer group">
                        <div className="w-8 h-8 rounded-md border border-border/50 shadow-sm group-hover:ring-2 ring-primary/50 transition-all" style={{ backgroundColor: color }} />
                        <input type="color" defaultValue={color.startsWith("#") ? color : "#000000"} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          onChange={(e) => handleSvgColorEdit(color, e.target.value)} />
                        <span className="text-[9px] text-muted-foreground block text-center mt-0.5 truncate w-8">{color.slice(0, 7)}</span>
                      </label>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              /* Raster editing tools */
              <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as any)} className="w-full">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="manual" className="text-xs"><Pencil className="h-3 w-3 mr-1" />Manual</TabsTrigger>
                  <TabsTrigger value="ai" className="text-xs"><RefreshCw className="h-3 w-3 mr-1" />AI</TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="mt-2 space-y-3">
                  {/* Toolbar */}
                  <div className="flex flex-wrap gap-1">
                    {([
                      { id: "select" as DrawTool, icon: MousePointer, tip: "Select" },
                      { id: "text" as DrawTool, icon: Type, tip: "Text" },
                      { id: "rect" as DrawTool, icon: Square, tip: "Rectangle" },
                      { id: "circle" as DrawTool, icon: Circle, tip: "Circle" },
                    ]).map(({ id, icon: Icon, tip }) => (
                      <Button key={id} variant={tool === id ? "default" : "outline"} size="icon" className="h-8 w-8"
                        onClick={() => setTool(id)} title={tip}>
                        <Icon className="h-3.5 w-3.5" />
                      </Button>
                    ))}
                    <div className="flex-1" />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} disabled={history.length === 0} title="Undo">
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Color */}
                  <div className="flex items-center gap-2">
                    <Label className="text-[10px] w-10">Color</Label>
                    <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <Input value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="h-7 text-xs flex-1 bg-secondary/30 border-border/30" />
                  </div>

                  {/* Text tool settings */}
                  {(tool === "text" || selectedText) && (
                    <div className="space-y-2 border border-border/20 rounded-md p-2 bg-secondary/10">
                      <Label className="text-[10px] text-muted-foreground">Text Settings</Label>
                      <Input
                        value={selectedText ? selectedText.text : newText}
                        onChange={(e) => selectedText ? updateSelectedText("text", e.target.value) : setNewText(e.target.value)}
                        className="h-7 text-xs bg-secondary/30 border-border/30"
                        placeholder="Text content"
                      />
                      <div className="flex gap-2">
                        <div className="flex items-center gap-1 flex-1">
                          <Label className="text-[10px]">Size</Label>
                          <Input type="number" min={10} max={120} value={selectedText?.fontSize ?? fontSize}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              selectedText ? updateSelectedText("fontSize", v) : setFontSize(v);
                            }}
                            className="h-7 text-xs w-16 bg-secondary/30 border-border/30" />
                        </div>
                        <Select value={selectedText?.fontWeight ?? fontWeight} onValueChange={(v) => selectedText ? updateSelectedText("fontWeight", v) : setFontWeight(v)}>
                          <SelectTrigger className="h-7 text-xs bg-secondary/30 border-border/30 w-20"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Regular</SelectItem>
                            <SelectItem value="bold">Bold</SelectItem>
                            <SelectItem value="900">Black</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {!selectedText && (
                        <Button size="sm" variant="secondary" className="w-full h-7 text-xs" onClick={addTextOverlay}>
                          <Type className="h-3 w-3 mr-1" />Add Text
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Shape settings */}
                  {selectedShape && (
                    <div className="space-y-2 border border-border/20 rounded-md p-2 bg-secondary/10">
                      <Label className="text-[10px] text-muted-foreground">Shape Settings</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[9px]">Width</Label>
                          <Input type="number" value={selectedShape.w} onChange={(e) => updateSelectedShape("w", Number(e.target.value))}
                            className="h-7 text-xs bg-secondary/30 border-border/30" />
                        </div>
                        <div>
                          <Label className="text-[9px]">Height</Label>
                          <Input type="number" value={selectedShape.h} onChange={(e) => updateSelectedShape("h", Number(e.target.value))}
                            className="h-7 text-xs bg-secondary/30 border-border/30" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] w-14">Opacity</Label>
                        <Slider value={[selectedShape.opacity]} onValueChange={([v]) => updateSelectedShape("opacity", v)} min={0} max={100} step={5} className="flex-1" />
                        <span className="text-[10px] w-8 text-right text-muted-foreground">{selectedShape.opacity}%</span>
                      </div>
                    </div>
                  )}

                  {/* Delete selected */}
                  {selectedOverlayId && (
                    <Button variant="destructive" size="sm" className="w-full h-7 text-xs" onClick={deleteSelected}>
                      Delete Selected
                    </Button>
                  )}

                  {/* Image adjustments */}
                  <div className="space-y-2 border-t border-border/20 pt-2">
                    <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <SlidersHorizontal className="h-3 w-3" />Adjustments
                    </Label>
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] w-16">Brightness</Label>
                      <Slider value={[brightness]} onValueChange={([v]) => setBrightness(v)} min={20} max={200} step={5} className="flex-1" />
                      <span className="text-[10px] w-8 text-right text-muted-foreground">{brightness}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] w-16">Contrast</Label>
                      <Slider value={[contrast]} onValueChange={([v]) => setContrast(v)} min={20} max={200} step={5} className="flex-1" />
                      <span className="text-[10px] w-8 text-right text-muted-foreground">{contrast}%</span>
                    </div>
                  </div>

                  {/* Transform */}
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRotation((r) => (r + 90) % 360)} title="Rotate">
                      <RotateCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant={flipH ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setFlipH((f) => !f)} title="Flip H">
                      <FlipHorizontal className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant={flipV ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setFlipV((f) => !f)} title="Flip V">
                      <FlipVertical className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="ai" className="mt-2 space-y-3">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 text-primary" />AI Regenerate
                  </Label>
                  <Textarea
                    placeholder="e.g. Make the background darker, change headline to 'Launch Sale'"
                    value={editInstruction}
                    onChange={(e) => setEditInstruction(e.target.value)}
                    rows={3}
                    className="bg-secondary/30 border-border/30 text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => onRegenerate(editInstruction)}
                    disabled={isRegenerating || !editInstruction.trim()}
                    className="w-full gradient-primary text-primary-foreground"
                  >
                    {isRegenerating ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Regenerating…</> : <><RefreshCw className="h-3.5 w-3.5 mr-1" />Regenerate</>}
                  </Button>
                </TabsContent>
              </Tabs>
            )}

            {/* SVG AI section */}
            {isSvg && (
              <div className="space-y-2 border-t border-border/30 pt-3 mt-3">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 text-primary" />AI Regenerate
                </Label>
                <Textarea placeholder="Describe changes…" value={editInstruction} onChange={(e) => setEditInstruction(e.target.value)} rows={2} className="bg-secondary/30 border-border/30 text-sm" />
                <Button size="sm" onClick={() => onRegenerate(editInstruction)} disabled={isRegenerating || !editInstruction.trim()} className="w-full gradient-primary text-primary-foreground">
                  {isRegenerating ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />…</> : <><RefreshCw className="h-3.5 w-3.5 mr-1" />Regenerate</>}
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-4 pt-0 flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" onClick={downloadAsset}>
            <Download className="h-3.5 w-3.5 mr-1" />Download
          </Button>
          {!isSvg && onSaveEdited && (
            <Button variant="secondary" size="sm" onClick={handleSaveEdited}>
              Save Edits
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
