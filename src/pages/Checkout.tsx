import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { z } from 'zod';

// Validation schemas
const shippingSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  email: z.string().trim().email('Invalid email address').max(255, 'Email must be less than 255 characters'),
  address: z.string().trim().min(1, 'Address is required').max(200, 'Address must be less than 200 characters'),
  city: z.string().trim().min(1, 'City is required').max(100, 'City must be less than 100 characters'),
  zipCode: z.string().trim().min(1, 'Zip code is required').max(20, 'Zip code must be less than 20 characters'),
  emergencyContactName: z.string().trim().max(100, 'Name must be less than 100 characters').optional(),
  emergencyContactPhone: z.string().trim().max(20, 'Phone must be less than 20 characters').optional(),
  emergencyContactEmail: z.string().trim().email('Invalid email address').max(255, 'Email must be less than 255 characters').optional().or(z.literal('')),
});

const pickupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  email: z.string().trim().email('Invalid email address').max(255, 'Email must be less than 255 characters'),
  emergencyContactName: z.string().trim().max(100, 'Name must be less than 100 characters').optional(),
  emergencyContactPhone: z.string().trim().max(20, 'Phone must be less than 20 characters').optional(),
  emergencyContactEmail: z.string().trim().email('Invalid email address').max(255, 'Email must be less than 255 characters').optional().or(z.literal('')),
});

export default function Checkout() {
  const { user } = useAuth();
  const { items, total, clearCart } = useCart();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'shipping' | 'pickup'>('shipping');
  const [pickupLocationId, setPickupLocationId] = useState('');
  const [pickupDate, setPickupDate] = useState<Date>();
  const [pickupTime, setPickupTime] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: user?.email || '',
    address: '',
    city: '',
    zipCode: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactEmail: '',
  });

  // Fetch active pickup locations
  const { data: pickupLocations } = useQuery({
    queryKey: ['pickup-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pickup_locations')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch delivery settings
  const { data: deliverySettings } = useQuery({
    queryKey: ['delivery-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_settings')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Set default delivery type based on what's enabled
  const [deliveryTypeInitialized, setDeliveryTypeInitialized] = useState(false);
  if (deliverySettings && !deliveryTypeInitialized) {
    if (!deliverySettings.shipping_enabled && deliverySettings.pickup_enabled) {
      setDeliveryType('pickup');
    } else if (deliverySettings.shipping_enabled && !deliverySettings.pickup_enabled) {
      setDeliveryType('shipping');
    }
    setDeliveryTypeInitialized(true);
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-xl mb-4">{t('checkout.loginRequired')}</p>
        <Button onClick={() => navigate('/auth')}>{t('nav.login')}</Button>
      </div>
    );
  }

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form data based on delivery type
      const schema = deliveryType === 'shipping' ? shippingSchema : pickupSchema;
      const validationResult = schema.safeParse(formData);
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        setLoading(false);
        return;
      }

      // Validate pickup fields if pickup is selected
      if (deliveryType === 'pickup') {
        if (!pickupLocationId) {
          toast.error(t('checkout.selectLocation'));
          setLoading(false);
          return;
        }
        if (!pickupDate) {
          toast.error(t('checkout.selectDate'));
          setLoading(false);
          return;
        }
        if (!pickupTime) {
          toast.error(t('checkout.selectTime'));
          setLoading(false);
          return;
        }
      }
      // Prepare shipping address based on delivery type
      const shippingAddress = deliveryType === 'shipping' 
        ? {
            address: formData.address,
            city: formData.city,
            zipCode: formData.zipCode,
          }
        : null;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_email: formData.email,
          user_name: formData.name,
          total_amount: total,
          shipping_address: shippingAddress,
          delivery_type: deliveryType,
          pickup_location_id: deliveryType === 'pickup' ? pickupLocationId : null,
          pickup_date: deliveryType === 'pickup' && pickupDate ? format(pickupDate, 'yyyy-MM-dd') : null,
          pickup_time: deliveryType === 'pickup' ? pickupTime : null,
          emergency_contact_name: formData.emergencyContactName || null,
          emergency_contact_phone: formData.emergencyContactPhone || null,
          emergency_contact_email: formData.emergencyContactEmail || null,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        price_at_purchase: item.price,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Send order notification email to admins
      try {
        await supabase.functions.invoke('send-order-notification', {
          body: { orderId: order.id },
        });
      } catch (emailError) {
        console.error('Failed to send order notification email:', emailError);
        // Don't block the checkout if email fails
      }

      // Create Stripe checkout session
      const { data: session, error: sessionError } = await supabase.functions.invoke(
        'create-checkout',
        {
          body: { orderId: order.id },
        }
      );

      if (sessionError) throw sessionError;

      // Redirect to Stripe
      if (session?.url) {
        clearCart();
        window.open(session.url, '_blank');
        navigate('/orders');
        toast.success(t('checkout.redirecting'));
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-4xl font-bold mb-8">{t('checkout.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('checkout.shippingInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('checkout.fullName')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('checkout.email')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            {/* Delivery Type Selection */}
            {(deliverySettings?.shipping_enabled || deliverySettings?.pickup_enabled) && (
              <div className="space-y-2 border-t pt-4">
                <Label>{t('checkout.deliveryMethod')}</Label>
                <RadioGroup value={deliveryType} onValueChange={(value: any) => setDeliveryType(value)}>
                  {deliverySettings?.shipping_enabled && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="shipping" id="shipping" />
                      <Label htmlFor="shipping" className="font-normal cursor-pointer">
                        {t('checkout.shipping')}
                      </Label>
                    </div>
                  )}
                  {deliverySettings?.pickup_enabled && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pickup" id="pickup" />
                      <Label htmlFor="pickup" className="font-normal cursor-pointer">
                        {t('checkout.selfPickup')}
                      </Label>
                    </div>
                  )}
                </RadioGroup>
              </div>
            )}

            {/* Shipping Address Fields - Only show if shipping */}
            {deliveryType === 'shipping' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="address">{t('checkout.address')}</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required={deliveryType === 'shipping'}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">{t('checkout.city')}</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required={deliveryType === 'shipping'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">{t('checkout.zipCode')}</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                      required={deliveryType === 'shipping'}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Pickup Options - Only show if pickup */}
            {deliveryType === 'pickup' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="pickupLocation">{t('checkout.pickupLocation')}</Label>
                  <Select value={pickupLocationId} onValueChange={setPickupLocationId} required>
                    <SelectTrigger>
                      <SelectValue placeholder={t('checkout.selectPickupLocation')} />
                    </SelectTrigger>
                    <SelectContent>
                      {pickupLocations?.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name} - {location.city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {pickupLocationId && pickupLocations && (
                    <div className="text-sm text-muted-foreground mt-2 p-3 bg-muted rounded-md">
                      {pickupLocations.find(l => l.id === pickupLocationId)?.address}
                      <br />
                      {pickupLocations.find(l => l.id === pickupLocationId)?.city}
                      {pickupLocations.find(l => l.id === pickupLocationId)?.instructions && (
                        <>
                          <br /><br />
                          <strong>{t('checkout.instructions')}:</strong> {pickupLocations.find(l => l.id === pickupLocationId)?.instructions}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{t('checkout.pickupDate')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !pickupDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {pickupDate ? format(pickupDate, 'PPP') : <span>{t('checkout.pickADate')}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={pickupDate}
                        onSelect={setPickupDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pickupTime">{t('checkout.pickupTime')}</Label>
                  <Input
                    id="pickupTime"
                    type="time"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    required={deliveryType === 'pickup'}
                    min="09:00"
                    max="18:00"
                  />
                  <p className="text-xs text-muted-foreground">{t('checkout.pickupHours')}</p>
                </div>
              </>
            )}

            {/* Emergency Contact Section */}
            <div className="space-y-4 border-t pt-4 mt-6">
              <div>
                <h3 className="text-lg font-semibold mb-1">{t('checkout.emergencyContact')}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('checkout.emergencyContactDescription')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactName">{t('checkout.emergencyContactName')}</Label>
                <Input
                  id="emergencyContactName"
                  value={formData.emergencyContactName}
                  onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                  placeholder={t('checkout.emergencyContactName')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactPhone">{t('checkout.emergencyContactPhone')}</Label>
                <Input
                  id="emergencyContactPhone"
                  type="tel"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                  placeholder="+372 1234 5678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactEmail">{t('checkout.emergencyContactEmail')}</Label>
                <Input
                  id="emergencyContactEmail"
                  type="email"
                  value={formData.emergencyContactEmail}
                  onChange={(e) => setFormData({ ...formData, emergencyContactEmail: e.target.value })}
                  placeholder="contact@example.com"
                />
              </div>
            </div>

              <div className="border-t pt-4 mt-6">
                <div className="flex justify-between text-xl font-bold">
                  <span>{t('cart.total')}:</span>
                  <span className="text-primary">€{total.toFixed(2)}</span>
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? t('checkout.processing') : t('checkout.payStripe')}
              </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
