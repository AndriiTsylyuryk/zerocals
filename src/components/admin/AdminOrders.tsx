import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, MapPin, Calendar, Clock, Ban } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminOrders() {
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (name)
          ),
          pickup_locations (
            name,
            address,
            city
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      
      // Send customer notification about status update
      await supabase.functions.invoke('send-customer-notification', {
        body: { 
          orderId: id, 
          notificationType: 'status_update',
          newStatus: status 
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Order status updated and customer notified');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const refundOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('refund-order', {
        body: { orderId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success(`Order cancelled and refunded €${data.refund.amount}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to refund order');
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders?.map((order) => (
        <Card key={order.id}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Order #{order.id.slice(0, 8)}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {order.user_name} ({order.user_email})
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(order.created_at!).toLocaleString()}
                </p>
              </div>
              <Badge variant={order.status === 'paid' ? 'default' : 'secondary'}>
                {order.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Delivery Type Info */}
              {order.delivery_type === 'pickup' && order.pickup_locations ? (
                <div className="bg-muted/50 p-3 rounded-md space-y-2 mb-4">
                  <div className="flex items-center gap-2 font-semibold">
                    <MapPin className="h-4 w-4" />
                    <span>Self Pickup</span>
                  </div>
                  <div className="text-sm space-y-1 ml-6">
                    <p><strong>{order.pickup_locations.name}</strong></p>
                    <p className="text-muted-foreground">
                      {order.pickup_locations.address}, {order.pickup_locations.city}
                    </p>
                    {order.pickup_date && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(order.pickup_date), 'PPP')}</span>
                      </div>
                    )}
                    {order.pickup_time && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{order.pickup_time}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-muted/50 p-3 rounded-md mb-4">
                  <div className="font-semibold mb-1">Shipping Delivery</div>
                  {order.shipping_address && typeof order.shipping_address === 'object' && (
                    <div className="text-sm text-muted-foreground">
                      {(order.shipping_address as any).address}, {(order.shipping_address as any).city}
                    </div>
                  )}
                </div>
              )}

              <div>
                <h4 className="font-semibold mb-2">Items:</h4>
                {order.order_items.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.products?.name} x{item.quantity}</span>
                    <span>€{(item.price_at_purchase * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary">€{Number(order.total_amount).toFixed(2)}</span>
              </div>

              {/* Emergency Contact Info */}
              {(order.emergency_contact_name || order.emergency_contact_phone || order.emergency_contact_email) && (
                <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-md border border-amber-200 dark:border-amber-800 mt-4">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                    Emergency Contact
                  </h4>
                  <div className="text-sm space-y-1 text-amber-900 dark:text-amber-100">
                    {order.emergency_contact_name && <p><strong>Name:</strong> {order.emergency_contact_name}</p>}
                    {order.emergency_contact_phone && <p><strong>Phone:</strong> {order.emergency_contact_phone}</p>}
                    {order.emergency_contact_email && <p><strong>Email:</strong> {order.emergency_contact_email}</p>}
                  </div>
                </div>
              )}

              <div className="flex gap-2 items-center flex-wrap">
                <Label className="text-sm font-medium">Update Status:</Label>
                <Select
                  value={order.status}
                  onValueChange={(status) =>
                    updateStatusMutation.mutate({ id: order.id, status })
                  }
                  disabled={order.status === 'cancelled'}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="preparing">Preparing</SelectItem>
                    <SelectItem value="ready">Ready for Pickup</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>

                {order.status !== 'cancelled' && order.stripe_payment_intent_id && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={refundOrderMutation.isPending}
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        Cancel & Refund
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Order & Issue Refund?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will cancel the order and issue a full refund of €{Number(order.total_amount).toFixed(2)} to the customer. 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>No, keep order</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => refundOrderMutation.mutate(order.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Yes, cancel & refund
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}
