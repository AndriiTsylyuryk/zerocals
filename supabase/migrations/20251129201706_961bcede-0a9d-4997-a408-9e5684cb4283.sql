-- Drop the existing policy for cancelling orders
DROP POLICY IF EXISTS "Users can cancel their own pending orders" ON public.orders;

-- Create updated policy that allows cancelling both pending and pending_cash orders
CREATE POLICY "Users can cancel their own pending orders" 
ON public.orders 
FOR UPDATE 
USING (
  (auth.uid() IS NOT NULL) 
  AND (user_email = get_auth_user_email()) 
  AND (status IN ('pending', 'pending_cash'))
)
WITH CHECK (status = 'cancelled');