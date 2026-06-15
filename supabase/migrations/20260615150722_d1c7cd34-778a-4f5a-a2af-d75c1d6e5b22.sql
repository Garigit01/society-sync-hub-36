
-- RLS policies for the society-docs storage bucket
CREATE POLICY "society-docs read for authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'society-docs');

CREATE POLICY "society-docs admin insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'society-docs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "society-docs admin update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'society-docs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "society-docs admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'society-docs' AND public.has_role(auth.uid(), 'admin'));
