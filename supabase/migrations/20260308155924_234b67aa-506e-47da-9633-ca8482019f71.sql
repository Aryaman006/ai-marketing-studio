
-- Add slug to blog_posts
ALTER TABLE public.blog_posts ADD COLUMN slug TEXT;

-- Public read access for published posts
CREATE POLICY "Anyone can view published blog posts"
  ON public.blog_posts FOR SELECT
  TO public
  USING (status = 'published');

-- Public read access to blog sites that have published posts
CREATE POLICY "Anyone can view blog sites with published posts"
  ON public.blog_sites FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.blog_posts bp
      WHERE bp.blog_site_id = id AND bp.status = 'published'
    )
  );
