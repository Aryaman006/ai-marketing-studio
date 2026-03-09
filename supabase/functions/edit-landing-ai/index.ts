import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: string;
    try {
      body = await req.text();
    } catch (e) {
      console.error("Failed to read request body:", e);
      return new Response(JSON.stringify({ error: "Request too large. Try editing a smaller section." }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(body);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { instruction, currentHtml, selectedElement, selectedSelector, fileContent, fileName, brandTone, brandType, brandColors, targetAudience } = parsed;

    if (!instruction || !currentHtml) {
      return new Response(JSON.stringify({ error: "Instruction and current HTML are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let brandInstructions = "";
    if (brandTone) brandInstructions += `\n- Brand tone: ${brandTone}`;
    if (brandType) brandInstructions += `\n- Brand category: ${brandType}`;
    if (brandColors) {
      const primary = brandColors.primary || "#7c3aed";
      const secondary = brandColors.secondary || "#a78bfa";
      brandInstructions += `\n- Primary color: ${primary}\n- Secondary color: ${secondary}`;
    }
    if (targetAudience) brandInstructions += `\n- Target audience: ${targetAudience}`;

    // Build file context if provided
    let fileContext = "";
    if (fileContent && fileName) {
      const isBase64 = fileContent.startsWith("data:");
      if (isBase64) {
        fileContext = `\n\nThe user has attached a file "${fileName}". It is a binary file (image/document). The user wants you to use the content/intent from this file to guide your edits. If it's an image, consider using it as a visual reference for style/layout changes.`;
      } else {
        fileContext = `\n\nThe user has attached a file "${fileName}" with the following content. Use this content to guide your edits to the landing page:\n---FILE CONTENT START---\n${fileContent.slice(0, 20000)}\n---FILE CONTENT END---`;
      }
    }

    let systemPrompt: string;
    let userPrompt: string;

    if (selectedElement && selectedSelector) {
      systemPrompt = `You are a landing page editor AI. The user wants to edit a specific element on their page.
You will receive the full HTML and the selected element's HTML.
Apply the user's instruction ONLY to the selected element and its children. Keep the rest of the page unchanged.
Return ONLY the complete modified HTML page. No markdown, no explanations, no code fences.${brandInstructions ? `\n\nBrand context:${brandInstructions}` : ""}${fileContext}`;

      userPrompt = `Selected element HTML:
\`\`\`
${selectedElement}
\`\`\`

Instruction: ${instruction}

Full page HTML:
\`\`\`
${currentHtml.slice(0, 50000)}
\`\`\``;
    } else {
      systemPrompt = `You are a landing page editor AI. The user wants to modify their landing page.
Apply the user's instruction to the page. Keep the overall structure intact unless the instruction specifically asks to change it.
Maintain responsive design and clean code.
Return ONLY the complete modified HTML page. No markdown, no explanations, no code fences.${brandInstructions ? `\n\nBrand context:${brandInstructions}` : ""}${fileContext}`;

      userPrompt = `Instruction: ${instruction}

Current page HTML:
\`\`\`
${currentHtml.slice(0, 50000)}
\`\`\``;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI editing failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content ?? "";
    content = content.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();

    return new Response(JSON.stringify({ html: content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("edit-landing-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
