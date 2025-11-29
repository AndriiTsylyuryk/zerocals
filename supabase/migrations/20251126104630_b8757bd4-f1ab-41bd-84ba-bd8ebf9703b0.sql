-- Create pickup_locations table
CREATE TABLE IF NOT EXISTS public.pickup_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  zip_code TEXT,
  instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pickup_locations ENABLE ROW LEVEL SECURITY;

-- Anyone can view active pickup locations
CREATE POLICY "Anyone can view active pickup locations"
  ON public.pickup_locations
  FOR SELECT
  USING (is_active = true);

-- Only admins can manage pickup locations
CREATE POLICY "Admins can manage pickup locations"
  ON public.pickup_locations
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add pickup fields to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'shipping',
  ADD COLUMN IF NOT EXISTS pickup_location_id UUID REFERENCES public.pickup_locations(id),
  ADD COLUMN IF NOT EXISTS pickup_date DATE,
  ADD COLUMN IF NOT EXISTS pickup_time TEXT;

-- Update timestamp trigger for pickup_locations
CREATE TRIGGER update_pickup_locations_updated_at
  BEFORE UPDATE ON public.pickup_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();