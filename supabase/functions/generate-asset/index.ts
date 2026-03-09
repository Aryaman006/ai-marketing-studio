import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { allowed, retryAfterMs } = checkRateLimit(user.id, 5);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait before generating more assets." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      });
    }

    const { prompt, assetType, editInstruction, existingImageUrl, brand, stockQuery } = await req.json();

    // --- Stock image search via Pexels ---
    if (stockQuery) {
      const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
      if (!PEXELS_API_KEY) throw new Error("PEXELS_API_KEY is not configured");
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(stockQuery)}&per_page=8&orientation=landscape`;
      const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
      if (!res.ok) throw new Error("Failed to search stock images");
      const data = await res.json();
      const images = (data.photos || []).map((p: any) => ({
        id: p.id, url: p.src.large2x || p.src.large, thumbnail: p.src.medium, alt: p.alt || stockQuery, photographer: p.photographer,
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

    const safeType = assetType?.slice(0, 50) || "ad_banner";
    const safePrompt = prompt.slice(0, 1500);

    // Build brand context
    const brandName = brand?.name || "";
    const primaryColor = brand?.primaryColor || "#7c3aed";
    const secondaryColor = brand?.secondaryColor || "#a78bfa";
    const brandTone = brand?.tone || "professional";
    const brandAudience = brand?.audience || "general audience";

    // Dimensions per type
    const svgDimensions: Record<string, { width: number; height: number }> = {
      ad_banner: { width: 728, height: 90 },
      social_media: { width: 1080, height: 1080 },
      logo: { width: 512, height: 512 },
      icon: { width: 256, height: 256 },
      story: { width: 1080, height: 1920 },
      thumbnail: { width: 1280, height: 720 },
      hero_image: { width: 1440, height: 600 },
    };

    const dims = svgDimensions[safeType] || { width: 800, height: 600 };

    // Type-specific creative direction for SVGs
    const typeDirections: Record<string, string> = {
      ad_banner: `Create a professional advertising banner SVG (${dims.width}x${dims.height}).
Layout: Bold headline text (max 8 words), optional subtext, prominent CTA button shape.
Style: Use layered geometric shapes, gradient backgrounds, rounded rectangles for buttons.
Text: Use <text> elements with font-weight="bold", font-size appropriate for banner (32-48px headline, 16-20px subtext).`,

      social_media: `Create a social media post SVG (${dims.width}x${dims.height}).
Layout: Eye-catching central visual, bold headline, brand accent shapes.
Style: Modern with geometric patterns, gradient overlays, bold typography.
Text: Large headline (48-64px), optional hashtag or tagline (20-24px).`,

      logo: `Create a professional logo mark SVG (${dims.width}x${dims.height}).
Style: Clean, minimalist, geometric. Must be recognizable at 32px. Use simple bold shapes.
Use max 2-3 colors. No complex gradients. Strong silhouette. Include brand name text if provided.`,

      icon: `Create a clean app-style icon SVG (${dims.width}x${dims.height}).
Style: Single concept, bold shapes, flat or subtle gradient. Must read clearly at 64px.
Use rounded shapes. Max 2 colors. No text.`,

      story: `Create a vertical story SVG graphic (${dims.width}x${dims.height}).
Layout: Full visual with overlay text, headline + CTA at bottom.
Style: Bold gradients, geometric shapes, large typography (64-80px headline).`,

      thumbnail: `Create a video thumbnail SVG (${dims.width}x${dims.height}).
Layout: Bold text overlay + accent shapes. High contrast for readability at small sizes.
Text: Large headline (56-72px bold), optional play button circle.`,

      hero_image: `Create a hero section background SVG (${dims.width}x${dims.height}).
Layout: Wide with space for text overlay on left. Abstract shapes or patterns on right.
Style: Premium gradients, geometric accents, atmospheric depth layers.`,
    };

    const typeDirection = typeDirections[safeType] || typeDirections.ad_banner;

    // --- Image editing with Gemini (for raster edits) ---
    if (editInstruction && existingImageUrl) {
      const editPrompt = `Edit this marketing graphic: ${editInstruction}. Keep it professional and on-brand with colors ${primaryColor} and ${secondaryColor}.`;

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: editPrompt },
              { type: "image_url", image_url: { url: existingImageUrl } },
            ],
          }],
          modalities: ["image", "text"],
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (resp.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("Image edit failed");
      }

      const editData = await resp.json();
      const imageData = editData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!imageData) return new Response(JSON.stringify({ error: "Edit produced no output. Try a different instruction." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!base64Match) return new Response(JSON.stringify({ error: "Invalid image format" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const ext = base64Match[1];
      const binaryData = Uint8Array.from(atob(base64Match[2]), (c) => c.charCodeAt(0));
      const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { error: uploadError } = await serviceClient.storage.from("assets").upload(fileName, binaryData, { contentType: `image/${ext}`, upsert: false });
      if (uploadError) throw new Error("Failed to save edited image");

      const { data: publicUrl } = serviceClient.storage.from("assets").getPublicUrl(fileName);
      return new Response(JSON.stringify({ imageUrl: publicUrl.publicUrl, storagePath: fileName, format: "raster" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- SVG Generation (default for all new assets) ---
    const svgPrompt = `You are a world-class SVG graphic designer who creates stunning, production-ready marketing graphics.

TASK: Create a ${safeType.replace(/_/g, " ")} SVG graphic.
USER REQUEST: ${safePrompt}

${typeDirection}

BRAND CONTEXT:
- Brand: "${brandName}"
- Primary color: ${primaryColor}
- Secondary color: ${secondaryColor}
- Tone: ${brandTone}
- Audience: ${brandAudience}

CRITICAL SVG REQUIREMENTS:
1. Start with <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dims.width} ${dims.height}" width="${dims.width}" height="${dims.height}">
2. Use <defs> for reusable gradients: <linearGradient>, <radialGradient> with brand colors
3. Create visual depth with layered shapes: backgrounds, accent shapes, foreground elements
4. ALL text must use <text> elements with:
   - font-family="Inter, Helvetica, Arial, sans-serif"
   - Appropriate font-size and font-weight
   - fill color with good contrast against background
5. Use <rect>, <circle>, <ellipse>, <polygon>, <path> for geometric designs
6. Add subtle design details: rounded corners (rx="12"), opacity variations, gradient overlays
7. Make it visually rich — use at LEAST 5-8 distinct visual elements (shapes, text, decorative accents)
8. Do NOT output a plain single-color rectangle with centered text — that is UNACCEPTABLE
9. Every element should have a descriptive id attribute for easy editing (e.g., id="headline", id="cta-button", id="accent-shape-1")

DESIGN QUALITY:
- Think like a Dribbble designer — this should look premium and polished
- Use color harmony: gradients between brand colors, lighter tints for accents, darker shades for depth
- Add decorative elements: dots, lines, circles, abstract shapes to fill negative space
- Typography hierarchy: headline large + bold, subtext smaller + lighter weight
- If there's a CTA, make it a rounded rectangle with contrasting text inside

Return ONLY valid SVG code. No markdown backticks, no explanation, no comments outside the SVG.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: svgPrompt }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted. Please add more credits." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("SVG generation failed");
    }

    const data = await response.json();
    let svgContent = data.choices?.[0]?.message?.content || "";

    // Extract SVG from response (strip any markdown wrapping)
    const svgMatch = svgContent.match(/<svg[\s\S]*?<\/svg>/i);
    if (!svgMatch) {
      // Retry with simpler prompt
      console.log("First SVG attempt failed, retrying with simplified prompt...");
      const retryResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: `Generate a professional SVG graphic (${dims.width}x${dims.height}) for: ${safePrompt.slice(0, 300)}. Use colors ${primaryColor} and ${secondaryColor}. Include gradients, geometric shapes, and text elements. Return ONLY the SVG code starting with <svg>.` }],
        }),
      });

      if (!retryResp.ok) throw new Error("SVG generation failed on retry");
      const retryData = await retryResp.json();
      svgContent = retryData.choices?.[0]?.message?.content || "";
      const retryMatch = svgContent.match(/<svg[\s\S]*?<\/svg>/i);
      if (!retryMatch) {
        return new Response(JSON.stringify({ error: "Failed to generate SVG. Try a simpler description." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      svgContent = retryMatch[0];
    } else {
      svgContent = svgMatch[0];
    }

    // Upload SVG to storage
    const fileName = `${user.id}/${crypto.randomUUID()}.svg`;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const encoder = new TextEncoder();
    const { error: uploadError } = await serviceClient.storage
      .from("assets")
      .upload(fileName, encoder.encode(svgContent), { contentType: "image/svg+xml", upsert: false });

    if (uploadError) throw new Error("Failed to save SVG");

    const { data: publicUrl } = serviceClient.storage.from("assets").getPublicUrl(fileName);

    return new Response(JSON.stringify({
      imageUrl: publicUrl.publicUrl,
      storagePath: fileName,
      svgContent,
      format: "svg",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("generate-asset error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
