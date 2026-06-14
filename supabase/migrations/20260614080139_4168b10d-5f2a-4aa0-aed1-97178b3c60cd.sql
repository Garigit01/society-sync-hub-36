
-- Function: admin sets base maintenance and instantly applies it to current month for every resident
CREATE OR REPLACE FUNCTION public.apply_base_amount(_amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m text := to_char(now(), 'YYYY-MM');
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.society_settings SET base_amount = _amount, updated_at = now() WHERE id = 1;
  UPDATE public.maintenance SET amount = _amount WHERE month = m;
  INSERT INTO public.maintenance (user_id, month, amount)
    SELECT p.id, m, _amount FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.maintenance mm WHERE mm.user_id = p.id AND mm.month = m
    );
END $$;

REVOKE EXECUTE ON FUNCTION public.apply_base_amount(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_base_amount(numeric) TO authenticated;

-- Allow admin to delete duties (for the Remove button)
DROP POLICY IF EXISTS "Admin delete duty" ON public.duties;
CREATE POLICY "Admin delete duty" ON public.duties FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
