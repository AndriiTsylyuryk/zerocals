import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Calendar, Clock, CreditCard, X, CheckCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function Orders() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  // Verify payment when redirected from Stripe
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId && !verifyingPayment) {
      verifyPayment(sessionId);
    }
  }, [searchParams]);

  const verifyPayment = async (sessionId: string) => {
    setVerifyingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { sessionId },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Payment successful! Your order has been confirmed.', {
          icon: <CheckCircle className="h-5 w-5 text-green-500" />,
          duration: 5000,
        });
        queryClient.invalidateQueries({ queryKey: ['orders', user?.email] });
      } else {
        toast.error(data?.message || 'Payment verification failed');
      }
    } catch (error: any) {
      console.error('Payment verification error:', error);
      toast.error('Failed to verify payment');
    } finally {
      setVerifyingPayment(false);
      // Clear session_id from URL
      setSearchParams({});
    }
  };

  const handlePayment = async (orderId: string) => {
    try {
      setProcessingOrderId(orderId);
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { orderId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Failed to create payment session');
    } finally {
      setProcessingOrderId(null);
    }
  };

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', user?.email] });
      toast.success('Order cancelled successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to cancel order');
    },
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', user?.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (name, image_url)
          ),
          pickup_locations (
            name,
            address,
            city
          )
        `)
        .eq('user_email', user?.email)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-xl mb-4">{t('orders.loginRequired') || 'Please log in to view your orders'}</p>
        <Button onClick={() => navigate('/auth')}>{t('nav.login')}</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">{t('orders.title')}</h1>

      {orders?.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl text-muted-foreground mb-4">{t('orders.noOrders')}</p>
          <Button onClick={() => navigate('/desserts')}>{t('orders.startShopping')}</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders?.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Order #{order.id.slice(0, 8)}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(order.created_at!).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={
                    order.status === 'paid' || order.status === 'completed' 
                      ? 'default' 
                      : order.status === 'pending' 
                      ? 'outline'
                      : order.status === 'pending_cash'
                      ? 'outline'
                      : order.status === 'cancelled'
                      ? 'destructive'
                      : 'secondary'
                  } className={
                    order.status === 'pending' 
                      ? 'border-yellow-500 text-yellow-600 bg-yellow-50'
                      : order.status === 'pending_cash'
                      ? 'border-green-500 text-green-600 bg-green-50'
                      : order.status === 'processing'
                      ? 'bg-blue-50 text-blue-600 border-blue-500'
                      : ''
                  }>
                    {order.status === 'pending_cash' ? t('orders.awaitingCash') : order.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Delivery Type Info */}
                  {order.delivery_type === 'pickup' && order.pickup_locations ? (
                    <div className="bg-muted/50 p-3 rounded-md space-y-2">
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
                    <div className="bg-muted/50 p-3 rounded-md">
                      <div className="font-semibold mb-1">Shipping Delivery</div>
                      {order.shipping_address && typeof order.shipping_address === 'object' && (
                        <div className="text-sm text-muted-foreground">
                          {(order.shipping_address as any).address}, {(order.shipping_address as any).city}
                        </div>
                      )}
                    </div>
                  )}

                   {/* Order Items */}
                  <div className="space-y-2">
                    {order.order_items.map((item: any) => (
                      <div key={item.id} className="flex justify-between">
                        <span>{item.products?.name} x{item.quantity}</span>
                        <span>€{(item.price_at_purchase * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>{t('cart.total')}</span>
                      <span className="text-primary">€{Number(order.total_amount).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Emergency Contact Info - only show if provided */}
                  {(order.emergency_contact_name || order.emergency_contact_phone || order.emergency_contact_email) && (
                    <div className="bg-muted/50 p-3 rounded-md border border-border/50 mt-4">
                      <h4 className="font-semibold mb-2 text-sm">Emergency Contact</h4>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        {order.emergency_contact_name && <p><strong>Name:</strong> {order.emergency_contact_name}</p>}
                        {order.emergency_contact_phone && <p><strong>Phone:</strong> {order.emergency_contact_phone}</p>}
                        {order.emergency_contact_email && <p><strong>Email:</strong> {order.emergency_contact_email}</p>}
                      </div>
                    </div>
                  )}

                  {/* Payment and Cancel Buttons for Pending Orders */}
                  {order.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handlePayment(order.id)}
                        disabled={processingOrderId === order.id || cancelOrderMutation.isPending}
                        className="flex-1"
                      >
                        {processingOrderId === order.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Pay Now
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => cancelOrderMutation.mutate(order.id)}
                        disabled={cancelOrderMutation.isPending || processingOrderId === order.id}
                      >
                        {cancelOrderMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Cancel Button for Cash Orders */}
                  {order.status === 'pending_cash' && (
                    <div className="flex gap-2">
                      <div className="flex-1 text-sm text-muted-foreground p-2 bg-muted rounded">
                        {t('checkout.cashNote')}
                      </div>
                      <Button 
                        variant="destructive"
                        onClick={() => cancelOrderMutation.mutate(order.id)}
                        disabled={cancelOrderMutation.isPending}
                      >
                        {cancelOrderMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
