import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/tracking";
import { Loader2 } from "lucide-react";

export default function TrackRedirect() {
  const { code } = useParams<{ code: string }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!code) return;

    (async () => {
      try {
        // Look up tracked link
        const { data: link, error: err } = await supabase
          .from("tracked_links" as any)
          .select("*")
          .eq("short_code", code)
          .maybeSingle();

        if (err || !link) {
          setError(true);
          return;
        }

        const typedLink = link as any;

        // Track the click
        await trackEvent({
          eventType: "click",
          metadata: {
            content_type: "tracked_link",
            link_id: typedLink.id,
            link_label: typedLink.label,
            destination: typedLink.destination_url,
            owner_id: typedLink.user_id,
            utm_source: typedLink.utm_source,
            utm_medium: typedLink.utm_medium,
            utm_campaign: typedLink.utm_campaign,
          },
        });

        // Increment click count
        await supabase
          .from("tracked_links" as any)
          .update({ click_count: (typedLink.click_count || 0) + 1 } as any)
          .eq("id", typedLink.id);

        // Redirect
        window.location.href = typedLink.destination_url;
      } catch {
        setError(true);
      }
    })();
  }, [code]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Link Not Found</h1>
          <p className="text-muted-foreground">This link doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
