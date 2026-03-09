-- Allow anonymous tracking event inserts (for public page views)
CREATE POLICY "Anyone can create tracking events"
  ON public.analytics_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Create tracked_links table for social media link tracking
CREATE TABLE public.tracked_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Untitled Link',
  destination_url text NOT NULL,
  short_code text NOT NULL UNIQUE,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tracked_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tracked links"
  ON public.tracked_links FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can read tracked links for redirect"
  ON public.tracked_links FOR SELECT
  TO anon, authenticated
  USING (true);