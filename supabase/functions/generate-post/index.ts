import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { allowed, retryAfterMs } = checkRateLimit(userId, 10);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait before generating more content." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      });
    }

    const { topic, tone, brandType, targetAudience } = await req.json();

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const safeTone = tone?.slice(0, 50) || "professional";
    const safeTopic = topic.slice(0, 500);
    const safeBrandType = brandType?.slice(0, 50) || "";
    const safeAudience = targetAudience?.slice(0, 200) || "";

    const systemPrompt = `You are a top-tier social media strategist and copywriter who creates viral, high-engagement content for brands. Your posts consistently get 10x the average engagement rate.

WRITING STYLE:
- Tone: ${safeTone}
- Open with a hook that stops the scroll — a bold claim, surprising stat, provocative question, or contrarian take
- Use short punchy sentences. One idea per line.
- Include 1-2 relevant emojis (not overdone)
- End with a clear CTA or thought-provoking question that drives comments
- Add 2-3 strategic hashtags at the end

${safeBrandType ? `BRAND: This is for a ${safeBrandType} brand.` : ""}
${safeAudience ? `AUDIENCE: Writing for ${safeAudience}. Speak directly to their pain points and aspirations.` : ""}

RULES:
- Keep under 280 characters for Twitter compatibility
- No generic filler ("In today's world...", "Did you know...")
- No quotes around the post
- Sound human, not AI — write like a founder or thought leader, not a corporate account
- Return ONLY the post text, nothing else`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write a viral social media post about: ${safeTopic}` },
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
    const content = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-post error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
