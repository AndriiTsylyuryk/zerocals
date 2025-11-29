-- Fix order_items RLS policy bug
-- The existing policy incorrectly compares orders.user_email (text) with (auth.uid())::text (UUID as text)
-- This will never match. We need to use get_auth_user_email() instead.

DROP POLICY IF EXISTS "Users can view their order items" ON order_items;

CREATE POLICY "Users can view their order items"
ON order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM orders
    WHERE orders.id = order_items.order_id
      AND (orders.user_email = get_auth_user_email() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Also fix the INSERT policy to be consistent
DROP POLICY IF EXISTS "Users can create items for their own orders" ON order_items;

CREATE POLICY "Users can create items for their own orders"
ON order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.id = order_items.order_id
      AND o.user_email = get_auth_user_email()
  )
);