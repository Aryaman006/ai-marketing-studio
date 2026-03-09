
-- Drop the problematic policies and recreate with proper roles
DROP POLICY IF EXISTS "Anyone can view published blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Anyone can view blog sites with published posts" ON public.blog_sites;

-- Recreate for both anon and authenticated
CREATE POLICY "Public can view published blog posts"
  ON public.blog_posts FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Public can view blog sites with published posts"
  ON public.blog_sites FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.blog_posts bp
      WHERE bp.blog_site_id = id AND bp.status = 'published'
    )
  );
