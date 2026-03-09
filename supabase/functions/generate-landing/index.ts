import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchStockImages(query: string, count = 4): Promise<string[]> {
  const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
  if (!PEXELS_API_KEY) return [];
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&size=large`, {
      headers: { Authorization: PEXELS_API_KEY },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.photos || []).map((p: any) => p.src?.large2x || p.src?.large || p.src?.original);
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    let userId = "anonymous";
    if (authHeader) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await supabase.auth.getUser();
      if (user) userId = user.id;
    }
    const { allowed, retryAfterMs } = checkRateLimit(userId, 5);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait before generating more content." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      });
    }

    const { topic, brandTone, brandType, brandColors, logoUrl, targetAudience, fileContent, fileName, faviconUrl } = await req.json();

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const safeTopic = topic.trim().slice(0, 500);

    // Pre-fetch real stock photos from Pexels
    const stockImages = await fetchStockImages(safeTopic, 5);
    
    let brandInstructions = "";
    if (brandTone) brandInstructions += `\n- Design tone: ${brandTone}`;
    if (brandType) brandInstructions += `\n- Brand category: ${brandType}`;
    if (brandColors) {
      const primary = brandColors.primary || "#7c3aed";
      const secondary = brandColors.secondary || "#a78bfa";
      brandInstructions += `\n- Primary brand color: ${primary}\n- Secondary brand color: ${secondary}\n- Use these colors for ALL buttons, gradients, headings, links, and accent elements`;
    }
    if (targetAudience) brandInstructions += `\n- Target audience: ${targetAudience}`;
    if (logoUrl) brandInstructions += `\n- Include logo: <img src="${logoUrl}" alt="Logo" style="height:40px"> in the header`;
    if (faviconUrl) brandInstructions += `\n- Add favicon: <link rel="icon" href="${faviconUrl}" type="image/png">`;

    let imageInstructions = "";
    if (stockImages.length > 0) {
      imageInstructions = `\n\nREAL STOCK IMAGES (USE THESE — do NOT use placeholder URLs or brand logos like Nike/Apple):
${stockImages.map((url, i) => `- Image ${i + 1}: ${url}`).join("\n")}
Use these real Pexels images throughout the page (hero background, feature sections, testimonials background). These are high-quality, royalty-free photos.`;
    }

    const systemPrompt = `You are a world-class landing page designer at a top creative agency. You build pages that WIN design awards AND convert at 10%+ rates. Your pages are visually stunning — not generic template-looking.

CRITICAL IMAGE RULES:
- NEVER use placeholder image URLs or fake brand logos (no Nike, Apple, Google logos, etc.)
- ONLY use the real stock image URLs provided below, or use CSS gradients/patterns as backgrounds
- For social proof logos, use text-only logos styled with CSS (font-weight: bold, letter-spacing, etc.)
- For avatars, use colored circles with initials styled in CSS

DESIGN DNA:
- BOLD typography with dramatic size contrast (hero headline 72-96px, body 18-20px)
- Rich layered visuals: overlapping elements, floating cards, glassmorphism, mesh gradients
- Cinematic hero sections with real stock photo backgrounds or animated CSS gradients
- Generous whitespace balanced with dense content sections
- Micro-interactions: hover transforms, scroll reveals, button animations
- Dark sections alternating with light for visual rhythm
- All elements properly aligned with consistent spacing

SEO REQUIREMENTS (CRITICAL):
- <title> tag: Under 60 chars, includes primary keyword
- <meta name="description"> with compelling 150-char summary
- <meta name="keywords"> with 5-8 relevant terms
- Single <h1> tag in hero section
- Semantic HTML: <header>, <main>, <section>, <footer>, <nav>
- All images have descriptive alt text
- Schema.org JSON-LD for Organization or Product
- <link rel="canonical" href="#">
- Open Graph meta tags (og:title, og:description, og:image)
- <meta name="viewport" content="width=device-width, initial-scale=1.0">

PAGE STRUCTURE (ALL required):
1. STICKY HEADER: Logo/brand name + nav links + primary CTA button with glassmorphism background
2. HERO SECTION: 
   - Full viewport height with real stock photo background (darkened overlay) or animated CSS gradient
   - Oversized headline (max 8 words) with gradient text or text-shadow
   - Subheadline with specific value proposition 
   - Two CTAs: primary (filled, large, rounded-full) + secondary (ghost/outline)
   - Floating stats badges or trust indicators
   - Subtle CSS animation (floating shapes, gradient shift)
3. SOCIAL PROOF: Metric counters (e.g. "10,000+ Users", "99.9% Uptime") styled as bold text — NO external logo images
4. FEATURES: 3-4 feature cards with large emoji/SVG icons, benefit-driven headlines, hover lift effect
5. HOW IT WORKS: 3 numbered steps with connecting lines/arrows
6. TESTIMONIALS: 2-3 cards with star ratings, quotes, CSS-styled avatar circles with initials
7. CTA SECTION: Bold gradient background, urgency text, large animated CTA button
8. FOOTER: Links, social icons (SVG), copyright

TECHNICAL:
- Single self-contained HTML file, all CSS in <style> tag
- Google Fonts: Import 2 fonts — one display (Space Grotesk, Outfit, Sora) + one body (Inter, DM Sans)
- Fully responsive with mobile-first media queries
- CSS Grid + Flexbox layouts
- Smooth scroll, IntersectionObserver for fade-in animations
- CSS custom properties for colors
- Border-radius: 16-24px for modern feel
- Proper alignment: all sections centered, max-width 1200px, consistent padding
${brandInstructions ? `\nBRAND GUIDELINES:${brandInstructions}` : "\n- Use a sophisticated dark theme (#0a0a0f background) with a vibrant accent (#7c3aed purple or #3b82f6 blue)"}
${imageInstructions}

QUALITY BAR: This page should look like it was built by a $50K agency — not a free template. Every pixel matters. All elements must be properly aligned and spaced.

Return ONLY the complete HTML code. No markdown, no backticks, no explanations.`;

    let fileContext = "";
    if (fileContent && fileName) {
      const isBase64 = fileContent.startsWith("data:");
      if (isBase64) {
        fileContext = `\n\nA reference file "${fileName}" has been provided. Use it as visual/content inspiration.`;
      } else {
        fileContext = `\n\nUse the following reference content from "${fileName}" to inform the page content:\n---\n${fileContent.slice(0, 15000)}\n---`;
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Create a stunning, high-converting landing page for: ${safeTopic}${fileContext}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content ?? "";
    content = content.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();

    return new Response(JSON.stringify({ html: content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-landing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
