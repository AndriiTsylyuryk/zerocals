-- Add emergency contact fields to orders table
ALTER TABLE public.orders
ADD COLUMN emergency_contact_name text,
ADD COLUMN emergency_contact_phone text,
ADD COLUMN emergency_contact_email text;

-- Add comment for clarity
COMMENT ON COLUMN public.orders.emergency_contact_name IS 'Emergency contact person name in case order cannot be fulfilled';
COMMENT ON COLUMN public.orders.emergency_contact_phone IS 'Emergency contact phone number';
COMMENT ON COLUMN public.orders.emergency_contact_email IS 'Emergency contact email address';