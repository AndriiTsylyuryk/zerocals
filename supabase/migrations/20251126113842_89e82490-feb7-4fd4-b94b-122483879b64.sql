-- Make shipping_address nullable since pickup orders don't need it
ALTER TABLE public.orders 
ALTER COLUMN shipping_address DROP NOT NULL;