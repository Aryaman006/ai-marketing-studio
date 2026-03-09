import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent, trackCtaClick } from "@/lib/tracking";
import { Loader2 } from "lucide-react";

export default function PublicLanding() {
  const { slug } = useParams<{ slug: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["public-landing", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("html_content, title, user_id")
        .eq("slug", slug!)
        .eq("is_public", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Track page view
  useEffect(() => {
    if (page) {
      trackEvent({
        eventType: "view",
        metadata: {
          content_type: "landing_page",
          content_slug: slug,
          content_title: page.title,
          owner_id: page.user_id,
        },
      });
    }
  }, [page, slug]);

  // Inject CTA click tracking into iframe
  useEffect(() => {
    if (!page || !iframeRef.current) return;

    const iframe = iframeRef.current;
    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        doc.addEventListener("click", (e) => {
          const target = e.target as HTMLElement;
          const anchor = target.closest("a, button, [role='button']");
          if (anchor) {
            trackCtaClick({
              content_type: "landing_page",
              content_slug: slug,
              content_title: page.title,
              owner_id: page.user_id,
              cta_text: anchor.textContent?.trim().slice(0, 100),
              cta_tag: anchor.tagName.toLowerCase(),
              cta_href: (anchor as HTMLAnchorElement).href || null,
            });
          }
        });
      } catch {
        // cross-origin frame - can't inject
      }
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [page, slug]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Page Not Found</h1>
          <p className="text-muted-foreground">This landing page doesn't exist or isn't public.</p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={page.html_content ?? ""}
      className="w-full h-screen border-0"
      sandbox="allow-scripts allow-same-origin"
      title={page.title ?? "Landing Page"}
    />
  );
}
