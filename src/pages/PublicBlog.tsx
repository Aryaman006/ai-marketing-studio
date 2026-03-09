import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Calendar, Clock, Loader2, ChevronRight, Rss } from "lucide-react";
import { format } from "date-fns";
import { trackEvent } from "@/lib/tracking";

function useThemeColors(siteId: string | undefined) {
  const { data } = useQuery({
    queryKey: ["blog-site-campaign-colors", siteId],
    queryFn: async () => {
      const { data: posts } = await supabase
        .from("blog_posts" as any)
        .select("id")
        .eq("blog_site_id", siteId!)
        .eq("status", "published")
        .limit(1);
      if (!posts?.length) return null;
      const { data: link } = await supabase
        .from("campaign_blog_posts")
        .select("campaign_id")
        .eq("blog_post_id", (posts[0] as any).id)
        .maybeSingle();
      if (!link) return null;
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("brand_colors, brand_tone, name, logo_url")
        .eq("id", link.campaign_id)
        .maybeSingle();
      return campaign as any;
    },
    enabled: !!siteId,
  });
  return data;
}

function estimateReadTime(content: string): number {
  return Math.max(1, Math.round((content?.split(/\s+/).length || 0) / 200));
}

export default function PublicBlog() {
  const { siteId, slug } = useParams();
  const campaign = useThemeColors(siteId);

  const primaryColor = campaign?.brand_colors?.primary || "#6366f1";
  const secondaryColor = campaign?.brand_colors?.secondary || "#818cf8";

  const { data: site, isLoading: loadingSite } = useQuery({
    queryKey: ["public-blog-site", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_sites" as any)
        .select("*")
        .eq("id", siteId!)
        .maybeSingle();
      if (error) return null;
      return data as any;
    },
    enabled: !!siteId,
  });

  const { data: posts, isLoading: loadingPosts } = useQuery({
    queryKey: ["public-blog-posts", siteId, slug],
    queryFn: async () => {
      let query = supabase
        .from("blog_posts" as any)
        .select("*")
        .eq("blog_site_id", siteId!)
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (slug) {
        const { data: bySlug } = await query.eq("slug", slug);
        if (bySlug && bySlug.length > 0) return bySlug as any[];
        const { data: byId } = await supabase
          .from("blog_posts" as any)
          .select("*")
          .eq("id", slug)
          .eq("status", "published");
        return (byId || []) as any[];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!siteId,
  });

  const isLoading = loadingSite || loadingPosts;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafafa" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#fafafa" }}>
        <h1 className="text-2xl font-bold text-gray-900">Blog not found</h1>
        <Link to="/" className="text-sm hover:underline" style={{ color: primaryColor }}>← Go home</Link>
      </div>
    );
  }

  if (slug && posts?.length === 1) {
    return <BlogPostView post={posts[0]} site={site} siteId={siteId!} slug={slug} primaryColor={primaryColor} secondaryColor={secondaryColor} campaign={campaign} />;
  }

  // Post listing — Magazine Style
  return (
    <div className="min-h-screen" style={{ background: "#f8f9fa", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Elegant Header */}
      <header className="relative" style={{ background: "#fff" }}>
        <div className="mx-auto max-w-5xl px-6">
          {/* Nav */}
          <div className="flex items-center justify-between py-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              {(campaign?.logo_url || site.logo_url) ? (
                <img src={campaign?.logo_url || site.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
              ) : (
                <div className="h-9 w-9 rounded-lg flex items-center justify-center font-bold text-white text-sm" style={{ background: primaryColor }}>
                  {site.name.charAt(0)}
                </div>
              )}
              <span className="font-semibold text-gray-900 text-lg tracking-tight">{site.name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Rss className="h-3.5 w-3.5" />
              <span>{posts?.length || 0} articles</span>
            </div>
          </div>

          {/* Hero */}
          <div className="py-16 sm:py-20 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.1] mb-5">
              {site.name}
            </h1>
            {site.description && (
              <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
                {site.description}
              </p>
            )}
            <div className="mt-8 h-1 w-12 rounded-full mx-auto" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }} />
          </div>
        </div>
      </header>

      {/* Posts Grid */}
      <main className="mx-auto max-w-5xl px-6 py-12">
        {!posts?.length ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-20 text-center">
            <p className="text-gray-400 text-lg">No published articles yet.</p>
            <p className="text-gray-300 text-sm mt-2">Check back soon for new content.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Featured Post */}
            {posts.length > 0 && (
              <Link
                to={`/blog/${siteId}/${posts[0].slug || posts[0].id}`}
                className="group block bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-500 hover:-translate-y-1"
              >
                <div className="grid md:grid-cols-2">
                  <div className="relative aspect-[4/3] md:aspect-auto overflow-hidden">
                    {posts[0].hero_image_url ? (
                      <img src={posts[0].hero_image_url} alt={posts[0].title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                    ) : (
                      <div className="w-full h-full min-h-[280px] flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}25)` }}>
                        <span className="text-7xl opacity-20">✍️</span>
                      </div>
                    )}
                  </div>
                  <div className="p-8 sm:p-10 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-[11px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ color: primaryColor, background: primaryColor + "12" }}>Featured</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-3 group-hover:text-indigo-600 transition-colors">
                      {posts[0].title}
                    </h2>
                    <p className="text-gray-500 leading-relaxed line-clamp-3 mb-6">
                      {posts[0].content?.replace(/[#*_\[\]`>]/g, "").slice(0, 250)}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{format(new Date(posts[0].created_at), "MMMM d, yyyy")}</span>
                      <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{estimateReadTime(posts[0].content || "")} min read</span>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* Rest of posts */}
            {posts.length > 1 && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.slice(1).map((post: any) => (
                  <Link
                    key={post.id}
                    to={`/blog/${siteId}/${post.slug || post.id}`}
                    className="group block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      {post.hero_image_url ? (
                        <img src={post.hero_image_url} alt={post.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}08, ${secondaryColor}15)` }}>
                          <span className="text-5xl opacity-15">✍️</span>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-gray-900 leading-snug mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">{post.title}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed line-clamp-2 mb-4">
                        {post.content?.replace(/[#*_\[\]`>]/g, "").slice(0, 150)}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{format(new Date(post.created_at), "MMM d, yyyy")}</span>
                        <span className="flex items-center gap-1 font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: primaryColor }}>
                          Read <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(campaign?.logo_url || site.logo_url) ? (
              <img src={campaign?.logo_url || site.logo_url} alt="" className="h-7 w-7 rounded-lg object-cover" />
            ) : (
              <div className="h-7 w-7 rounded-lg flex items-center justify-center font-bold text-white text-xs" style={{ background: primaryColor }}>
                {site.name.charAt(0)}
              </div>
            )}
            <span className="text-sm font-medium text-gray-700">{site.name}</span>
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} {site.name}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// ─── Inline formatting ────────────
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatInline(text: string): string {
  let safe = escapeHtml(text);
  return safe
    .replace(/\*\*(.+?)\*\*/g, "<strong class='font-semibold text-gray-900'>$1</strong>")
    .replace(/__(.+?)__/g, "<strong class='font-semibold text-gray-900'>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono'>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      const sanitizedUrl = /^https?:\/\//i.test(url) ? url : "#";
      return `<a href='${escapeHtml(sanitizedUrl)}' class='underline underline-offset-2 decoration-1 hover:decoration-2' target='_blank' rel='noopener noreferrer'>${label}</a>`;
    });
}

function FormattedContent({ content, primaryColor }: { content: string; primaryColor: string }) {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let key = 0;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre key={key++} className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-sm font-mono text-gray-700 overflow-x-auto my-6">
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = [];
      }
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) { codeLines.push(line); continue; }
    if (!trimmed) { elements.push(<div key={key++} className="h-4" />); continue; }

    if (trimmed.startsWith("# ")) {
      elements.push(<h1 key={key++} className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-12 mb-5 leading-tight tracking-tight" dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(2)) }} />);
    } else if (trimmed.startsWith("## ")) {
      elements.push(<h2 key={key++} className="text-2xl sm:text-[1.65rem] font-bold text-gray-900 mt-10 mb-4 leading-snug" dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(3)) }} />);
    } else if (trimmed.startsWith("### ")) {
      elements.push(<h3 key={key++} className="text-xl font-semibold text-gray-800 mt-8 mb-3" dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(4)) }} />);
    } else if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote key={key++} className="border-l-4 pl-5 py-3 my-6 text-gray-600 italic text-[17px] leading-relaxed rounded-r-xl bg-gray-50/50" style={{ borderColor: primaryColor + "60" }}
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(2)) }} />
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(<li key={key++} className="ml-6 list-disc text-gray-700 leading-relaxed mb-1.5 text-[17px]" dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(2)) }} />);
    } else if (/^\d+\.\s/.test(trimmed)) {
      elements.push(<li key={key++} className="ml-6 list-decimal text-gray-700 leading-relaxed mb-1.5 text-[17px]" dangerouslySetInnerHTML={{ __html: formatInline(trimmed.replace(/^\d+\.\s/, "")) }} />);
    } else if (trimmed === "---" || trimmed === "***") {
      elements.push(<hr key={key++} className="my-10 border-gray-200" />);
    } else {
      elements.push(
        <p key={key++} className="text-gray-700 leading-[1.85] mb-5 text-[17px]" dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />
      );
    }
  }

  return <>{elements}</>;
}

// ─── Single Post View ────────────
function BlogPostView({ post, site, siteId, slug, primaryColor, secondaryColor, campaign }: {
  post: any; site: any; siteId: string; slug: string;
  primaryColor: string; secondaryColor: string; campaign: any;
}) {
  useEffect(() => {
    trackEvent({
      eventType: "view",
      metadata: { content_type: "blog_post", content_slug: slug, content_title: post.title, owner_id: post.user_id, blog_site_id: siteId },
    });
  }, [post, slug, siteId]);

  const readTime = estimateReadTime(post.content || "");

  return (
    <div className="min-h-screen" style={{ background: "#fff", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Dynamic favicon */}
      {(campaign?.logo_url || site.logo_url) && (
        <link rel="icon" href={campaign?.logo_url || site.logo_url} type="image/png" />
      )}
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100/80">
        <div className="mx-auto max-w-3xl px-6 h-14 flex items-center justify-between">
          <Link to={`/blog/${siteId}`} className="flex items-center gap-2.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {(campaign?.logo_url || site.logo_url) ? (
              <img src={campaign?.logo_url || site.logo_url} alt="" className="h-6 w-6 rounded-md object-cover" />
            ) : null}
            <span className="font-medium">{site.name}</span>
          </Link>
          <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">{readTime} min read</span>
        </div>
      </nav>

      <article className="mx-auto max-w-3xl px-6">
        {/* Hero */}
        {post.hero_image_url && (
          <div className="relative -mx-6 sm:mx-0 mt-0 sm:mt-10 sm:rounded-3xl overflow-hidden shadow-xl">
            <img src={post.hero_image_url} alt={post.title} className="w-full aspect-[2/1] object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-10">
              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold text-white leading-[1.15] drop-shadow-lg max-w-2xl">
                {post.title}
              </h1>
              <div className="flex items-center gap-4 mt-4 text-sm text-white/70">
                <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{format(new Date(post.created_at), "MMMM d, yyyy")}</span>
                <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{readTime} min read</span>
              </div>
            </div>
          </div>
        )}

        {/* Title (no hero) */}
        {!post.hero_image_url && (
          <div className="pt-14 pb-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-[1.1] tracking-tight">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 mt-5 text-sm text-gray-400">
              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{format(new Date(post.created_at), "MMMM d, yyyy")}</span>
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{readTime} min read</span>
            </div>
            <div className="mt-8 h-1 w-16 rounded-full" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }} />
          </div>
        )}

        {/* Content */}
        <div className="py-10" style={{ fontFamily: "'Georgia', 'Merriweather', serif" }}>
          <FormattedContent content={post.content || ""} primaryColor={primaryColor} />
        </div>

        {/* Inline images */}
        {Array.isArray(post.images) && post.images.length > 0 && (
          <div className="pb-10 grid gap-4 sm:grid-cols-2">
            {post.images.map((url: string, i: number) => (
              <img key={i} src={url} alt="" className="w-full rounded-2xl shadow-sm border border-gray-100" loading="lazy" />
            ))}
          </div>
        )}

        {/* Back */}
        <div className="border-t border-gray-100 py-10 mb-10">
          <Link to={`/blog/${siteId}`} className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:underline" style={{ color: primaryColor }}>
            <ArrowLeft className="h-4 w-4" />Back to all articles
          </Link>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50/50">
        <div className="mx-auto max-w-3xl px-6 py-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(campaign?.logo_url || site.logo_url) ? (
              <img src={campaign?.logo_url || site.logo_url} alt="" className="h-6 w-6 rounded-md object-cover" />
            ) : null}
            <span className="text-sm font-medium text-gray-600">{site.name}</span>
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
