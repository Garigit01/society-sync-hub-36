
-- 1) Enable RLS on profiles (policies already exist)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2) Admin delete policies
CREATE POLICY "Admin delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete maintenance" ON public.maintenance
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete complaints" ON public.complaints
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3) Extra maintenance columns
ALTER TABLE public.maintenance
  ADD COLUMN IF NOT EXISTS penalty numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS past_dues numeric NOT NULL DEFAULT 0;

-- 4) Society settings (singleton)
CREATE TABLE public.society_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  base_amount numeric NOT NULL DEFAULT 2500,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.society_settings TO authenticated, anon;
GRANT ALL ON public.society_settings TO service_role;
ALTER TABLE public.society_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads settings" ON public.society_settings FOR SELECT USING (true);
CREATE POLICY "Admin updates settings" ON public.society_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.society_settings (id, base_amount) VALUES (1, 2500) ON CONFLICT DO NOTHING;

-- 5) Documents
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('AGM Reports','Maintenance Receipts','Society Rules')),
  title text NOT NULL,
  file_path text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read documents" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage documents" ON public.documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6) Flat history
CREATE TABLE public.flat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flat text NOT NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_name text,
  tenant_contact text,
  action text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.flat_history TO authenticated;
GRANT ALL ON public.flat_history TO service_role;
ALTER TABLE public.flat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read flat history" ON public.flat_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner/admin insert flat history" ON public.flat_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manage flat history" ON public.flat_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7) Tighten has_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 8) Documents storage bucket + policies (bucket creation via SQL is allowed via insert on storage.buckets? per knowledge no — must use tool)
-- Storage policies for the 'society-docs' bucket (created via the storage tool in a follow-up step)
CREATE POLICY "Auth read society-docs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'society-docs');
CREATE POLICY "Admin write society-docs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'society-docs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update society-docs" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'society-docs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete society-docs" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'society-docs' AND public.has_role(auth.uid(), 'admin'));
