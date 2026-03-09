
-- Blog Sites table
CREATE TABLE public.blog_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blog sites" ON public.blog_sites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own blog sites" ON public.blog_sites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own blog sites" ON public.blog_sites FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own blog sites" ON public.blog_sites FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Blog Posts table
CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_site_id UUID NOT NULL REFERENCES public.blog_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Post',
  content TEXT,
  hero_image_url TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blog posts" ON public.blog_posts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own blog posts" ON public.blog_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own blog posts" ON public.blog_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own blog posts" ON public.blog_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_blog_sites_updated_at BEFORE UPDATE ON public.blog_sites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
