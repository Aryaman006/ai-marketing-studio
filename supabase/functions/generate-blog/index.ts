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
    const { allowed, retryAfterMs } = checkRateLimit(userId, 5);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait before generating more content." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      });
    }

    const { topic, style } = await req.json();

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const safeStyle = style && typeof style === "string" ? style.slice(0, 50) : "informative";
    const safeTopic = topic.slice(0, 500);

    const systemPrompt = `You are a senior content strategist who has driven millions in organic traffic. You write blog posts that rank #1 on Google, get shared on LinkedIn, and establish thought leadership. Your writing is sharp, specific, and impossible to skim past.

WRITING STYLE: ${safeStyle}

SEO MASTERY:
- Title (H1): Under 60 chars, front-load the primary keyword, make it irresistible to click
- Include a meta description suggestion at the top as a comment: <!-- meta: description here -->
- Use the primary keyword in H1, first paragraph, 2-3 H2s, and conclusion
- Include 3-5 LSI (related) keywords naturally throughout
- Internal linking suggestions where relevant (as placeholder links)
- Aim for featured snippet format: answer the core question in 40-50 words early on

CONTENT ARCHITECTURE:
- **Hook** (first 2 sentences): Start with a surprising statistic, bold claim, or relatable pain point — NOT "In today's world..."
- **Promise**: Tell the reader exactly what they'll learn/gain
- **4-6 main sections** with H2 headings that are benefit-driven and keyword-rich
  - Each section: lead with the insight, support with data/example, end with actionable takeaway
- **Subheadings** (H3) within longer sections for scanability
- **Conclusion**: Summarize key points + specific CTA (not generic "hope this helped")

WRITING RULES:
- Paragraphs: 2-3 sentences max
- Active voice exclusively
- Specific numbers > vague claims ("increased by 47%" not "significantly improved")
- Use analogies and metaphors to explain complex ideas
- Bold key phrases and important statistics
- Include at least one numbered list and one bullet list
- Add a "Key Takeaway" or "Pro Tip" callout box (use > blockquote)
- Reference real tools, frameworks, or methodologies (not made-up ones)

QUALITY BAR:
- 1200-1800 words (comprehensive but not bloated)
- Every sentence must earn its place — delete anything that doesn't teach, prove, or persuade
- Sound like a respected industry voice, not a generic content mill
- Include data points (cite sources as [Source Name] placeholders)
- End sections with transition sentences that pull readers forward

FORMAT: Return ONLY markdown content. No meta-commentary, no "here's your blog post" intro.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write an expert, SEO-optimized blog post about: ${safeTopic}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-blog error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
