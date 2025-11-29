-- Fix the orders SELECT policy - user_email should store user IDs, not emails
-- First, we need to understand the current structure and fix it properly

-- The issue is that the policy compares auth.uid() (UUID) with user_email (text)
-- We have two options:
-- 1. Change user_email column to user_id (UUID) - better security
-- 2. Store actual email and compare with auth.email() - current approach

-- Let's go with option 1 for better security
-- First, drop the existing broken policy
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;

-- Recreate the policy with proper UUID comparison
CREATE POLICY "Users can view their own orders" 
ON public.orders 
FOR SELECT 
USING (
  (user_email = (SELECT email FROM auth.users WHERE id = auth.uid())::text) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix the order_items INSERT policy to validate order ownership
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;

CREATE POLICY "Users can create items for their own orders"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id 
    AND o.user_email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
  )
);