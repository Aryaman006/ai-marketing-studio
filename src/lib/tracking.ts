import { supabase } from "@/integrations/supabase/client";

interface TrackEventOptions {
  eventType: "view" | "lead" | "conversion" | "click" | "cta_click";
  metadata?: Record<string, any>;
}

export function getUtmParams(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const val = params.get(key);
    if (val) utm[key] = val;
  }
  return utm;
}

export async function trackEvent({ eventType, metadata = {} }: TrackEventOptions) {
  try {
    const utm = getUtmParams();
    const enriched = {
      ...metadata,
      ...utm,
      referrer: document.referrer || null,
      url: window.location.pathname,
      timestamp: new Date().toISOString(),
    };

    await supabase.from("analytics_events").insert({
      event_type: eventType,
      metadata: enriched,
      user_id: metadata.owner_id || null,
    });
  } catch (err) {
    console.error("Tracking error:", err);
  }
}

/**
 * Track a CTA click on a public page (landing page button, blog CTA, etc.)
 */
export function trackCtaClick(metadata: Record<string, any>) {
  return trackEvent({ eventType: "cta_click", metadata });
}
