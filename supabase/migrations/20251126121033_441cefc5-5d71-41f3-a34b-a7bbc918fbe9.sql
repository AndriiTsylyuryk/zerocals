-- Fix security vulnerability in orders table RLS policies
-- Drop existing policies that use get_auth_user_email() without proper auth checks
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can create their own orders" ON orders;
DROP POLICY IF EXISTS "Users can cancel their own pending orders" ON orders;

-- Recreate policies with explicit authentication checks
-- Policy for viewing own orders
CREATE POLICY "Users can view their own orders"
ON orders
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (user_email = get_auth_user_email() OR has_role(auth.uid(), 'admin'::app_role))
);

-- Policy for creating orders
CREATE POLICY "Authenticated users can create their own orders"
ON orders
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND user_email = get_auth_user_email()
);

-- Policy for cancelling pending orders
CREATE POLICY "Users can cancel their own pending orders"
ON orders
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND user_email = get_auth_user_email() 
  AND status = 'pending'
)
WITH CHECK (
  status IN ('pending', 'cancelled')
);