-- Drop the insecure "Anyone can create orders" policy
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;

-- Create a secure policy that requires authentication and validates user_email
CREATE POLICY "Authenticated users can create their own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);