-- Create delivery settings table
CREATE TABLE public.delivery_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_enabled boolean NOT NULL DEFAULT true,
  pickup_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage settings
CREATE POLICY "Admins can manage delivery settings"
ON public.delivery_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Anyone can view settings
CREATE POLICY "Anyone can view delivery settings"
ON public.delivery_settings
FOR SELECT
TO authenticated
USING (true);

-- Insert default settings
INSERT INTO public.delivery_settings (shipping_enabled, pickup_enabled)
VALUES (false, true);

-- Add trigger for updated_at
CREATE TRIGGER update_delivery_settings_updated_at
BEFORE UPDATE ON public.delivery_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();