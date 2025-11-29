-- Create security definer function to safely get authenticated user's email
CREATE OR REPLACE FUNCTION public.get_auth_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- Drop existing policies on orders table that directly query auth.users
DROP POLICY IF EXISTS "Authenticated users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;

-- Recreate policies using the security definer function
CREATE POLICY "Authenticated users can create their own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (user_email = public.get_auth_user_email());

CREATE POLICY "Users can view their own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (user_email = public.get_auth_user_email() OR public.has_role(auth.uid(), 'admin'));

-- Drop existing policy on order_items that directly queries auth.users
DROP POLICY IF EXISTS "Users can create items for their own orders" ON public.order_items;

-- Recreate policy using the security definer function
CREATE POLICY "Users can create items for their own orders"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.id = order_items.order_id 
    AND o.user_email = public.get_auth_user_email()
  )
);