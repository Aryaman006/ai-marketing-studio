-- Fix blog_sites public SELECT policy to correctly reference outer table id
DROP POLICY IF EXISTS "Public can view blog sites with published posts" ON public.blog_sites;

CREATE POLICY "Public can view blog sites with published posts"
ON public.blog_sites
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.blog_posts bp
    WHERE bp.blog_site_id = blog_sites.id
      AND bp.status = 'published'
  )
);