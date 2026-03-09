import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function searchPexels(query: string, count = 8): Promise<{ url: string; alt: string }[]> {
  const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
  if (!PEXELS_API_KEY) return [];
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=portrait`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.photos || []).map((p: any) => ({
      url: p.src.large2x || p.src.large,
      alt: p.alt || query,
    }));
  } catch { return []; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { allowed, retryAfterMs } = checkRateLimit(user.id, 3);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      });
    }

    const { prompt, brand, stockQuery, imageUrls } = await req.json();

    // --- Stock image search endpoint ---
    if (stockQuery) {
      const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
      if (!PEXELS_API_KEY) throw new Error("PEXELS_API_KEY is not configured");
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(stockQuery)}&per_page=12&orientation=landscape`;
      const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
      if (!res.ok) throw new Error("Failed to search stock images");
      const data = await res.json();
      const images = (data.photos || []).map((p: any) => ({
        id: p.id, url: p.src.large2x || p.src.large,
        thumbnail: p.src.medium, alt: p.alt || stockQuery, photographer: p.photographer,
      }));
      return new Response(JSON.stringify({ images }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Use AI to extract the best Pexels search queries from the prompt
    const LOVABLE_API_KEY_PRE = Deno.env.get("LOVABLE_API_KEY");
    let pexelsQueries: string[] = [];
    if (LOVABLE_API_KEY_PRE) {
      try {
        const kwRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY_PRE}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{
              role: "user",
              content: `Extract 3 short Pexels stock photo search queries (2-4 words each) that would produce high-quality, cinematic background images for this video concept. Focus on the scene/mood/setting, NOT logos or brand names.
Prompt: "${prompt.slice(0, 500)}"
Return ONLY a JSON array of strings, e.g. ["luxury fashion model", "golden sunset city", "celebration confetti"]. No markdown.`
            }],
          }),
        });
        if (kwRes.ok) {
          const kwData = await kwRes.json();
          let kwContent = kwData.choices?.[0]?.message?.content || "[]";
          kwContent = kwContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          pexelsQueries = JSON.parse(kwContent);
        }
      } catch (e) { console.warn("Keyword extraction failed:", e); }
    }
    if (!pexelsQueries.length) pexelsQueries = [prompt.split(/[\s,]+/).filter((w: string) => w.length > 3).slice(0, 3).join(" ") || "professional marketing"];

    // Fetch high-quality images from multiple queries in parallel
    const pexelsResults = await Promise.all(
      pexelsQueries.slice(0, 3).map((q: string) => searchPexels(q, 2))
    );
    const autoImages = pexelsResults.flat();
    const allImageUrls = [...(imageUrls || []), ...autoImages.map((img: { url: string }) => img.url)].slice(0, 8);

    const safePrompt = prompt.slice(0, 1500);
    const brandName = brand?.name || "";
    const primaryColor = brand?.primaryColor || "#7c3aed";
    const secondaryColor = brand?.secondaryColor || "#a78bfa";
    const brandTone = brand?.tone || "professional";
    const logoUrl = brand?.logoUrl || "";

    const imageInstructions = allImageUrls.length
      ? `\nAVAILABLE IMAGES (use these as slide backgrounds with type "image"):
${allImageUrls.map((url: string, i: number) => `  Image ${i + 1}: "${url}"`).join("\n")}

CRITICAL: Use at least ${Math.min(3, allImageUrls.length)} of these images as slide backgrounds with:
  "background": { "type": "image", "src": "<url>", "overlay": "rgba(0,0,0,0.45)" }
This creates cinematic slides with real photography + text overlays.`
      : "";

    const scenePrompt = `You are an elite motion graphics designer creating highly engaging, professional marketing reels for Instagram/TikTok.
CRITICAL: The output MUST NOT look like a generic AI-generated video. It must feel organic, premium, dynamic, and human-crafted.

USER REQUEST: ${safePrompt}
${imageInstructions}

BRAND:
- Name: "${brandName}"
- Primary: ${primaryColor}
- Secondary: ${secondaryColor}
- Tone: ${brandTone}
- Logo: ${logoUrl || "none"}

Generate a JSON scene definition for a 15-20 second dynamic motion graphic with 4-6 slides.

Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "title": "Video title",
  "duration": 18,
  "width": 1080,
  "height": 1920,
  "backgroundColor": "#0f0f23",
  "slides": [
    {
      "id": "slide-1",
      "duration": 4,
      "transition": "zoom",
      "background": {
        "type": "image",
        "src": "IMAGE_URL_HERE",
        "overlay": "rgba(0,0,0,0.6)"
      },
      "elements": [
        {
          "type": "text",
          "content": "STUNNING HEADLINE",
          "x": 540, "y": 800,
          "fontSize": 90, "fontWeight": "bold",
          "color": "#ffffff", "textAlign": "center",
          "maxWidth": 900, "animation": "bounce",
          "shadow": true
        },
        {
          "type": "text",
          "content": "Organic & Human-crafted",
          "x": 540, "y": 950,
          "fontSize": 36, "fontWeight": "normal",
          "color": "#ffffffdd", "textAlign": "center",
          "maxWidth": 800, "animation": "fadeUp",
          "animationDelay": 0.2
        },
        {
          "type": "shape", "shape": "circle",
          "x": 200, "y": 400, "width": 150, "height": 150,
          "gradient": ["${primaryColor}aa", "${secondaryColor}66"],
          "animation": "popIn", "animationDelay": 0.1, "blur": 15
        }
      ]
    }
  ]
}

FUN & DYNAMIC ANIMATIONS (USE A WIDE VARIETY): "bounce", "popIn", "scale", "scaleUp", "slideLeft", "slideRight", "spin", "typewriter", "blur", "fadeUp", "fadeDown", "fadeIn"
ELEMENT TYPES: "text", "shape" (circle/rect/diamond/line/rounded), "cta" (button with bgColor + gradient), "image" (with "src")
TRANSITION OPTIONS: "fade", "slide", "zoom", "wipe"

ELITE DESIGN RULES FOR A PRO REEL (NO AI VIBES):
1. ORGANIC FEEL: Avoid perfect symmetry. Place shapes off-center, use dynamic scaling, and add large blurred shapes in the background for cinematic depth.
2. FUN ANIMATIONS: Use "bounce", "popIn", "scaleUp", and "spin" for energetic elements. Stagger animations heavily with "animationDelay" (e.g., 0.0, 0.2, 0.4) so elements pop in sequentially.
3. CINEMATIC BACKGROUNDS: When using image backgrounds, mandate strong dark overlays ("rgba(0,0,0,0.5)") so white text pops instantly and feels premium.
4. TYPOGRAPHY: Massive, punchy bold headlines (80-110px). Subtitles should be smaller and lighter (30-40px). DO NOT crowd the screen with text.
5. DECORATIVE ELEMENTS: Add floating circles or diamonds with gradients and blur (e.g., "blur": 20) to create a premium bokeh/light-leak effect on almost every slide.
6. CTA: The final slide MUST have a massive, juicy CTA button with a gradient, a "scaleUp" or "bounce" animation, and bold text.
7. TRANSITIONS: Vary them! Use "zoom" or "slide" to keep energy high, instead of just "fade".

Return ONLY the JSON object.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: scenePrompt }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Video scene generation failed");
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let sceneData;
    try {
      sceneData = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return new Response(JSON.stringify({ error: "Failed to generate video scene. Try a different prompt." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      sceneData = JSON.parse(jsonMatch[0]);
    }

    if (!sceneData.slides || !Array.isArray(sceneData.slides) || sceneData.slides.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid scene generated. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sceneData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-video error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
