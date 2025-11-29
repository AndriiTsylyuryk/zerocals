-- Add policy to allow users to cancel their own pending orders
CREATE POLICY "Users can cancel their own pending orders"
ON orders
FOR UPDATE
TO authenticated
USING (user_email = get_auth_user_email() AND status = 'pending')
WITH CHECK (status IN ('pending', 'cancelled'));