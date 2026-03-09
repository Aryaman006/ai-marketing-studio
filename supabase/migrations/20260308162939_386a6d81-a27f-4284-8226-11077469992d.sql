-- Allow anon to increment click_count on tracked links
CREATE POLICY "Anyone can update tracked link click count"
  ON public.tracked_links FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);