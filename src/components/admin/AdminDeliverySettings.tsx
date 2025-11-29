import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Truck, MapPin } from 'lucide-react';

export default function AdminDeliverySettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
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

  const updateMutation = useMutation({
    mutationFn: async (updates: { shipping_enabled?: boolean; pickup_enabled?: boolean }) => {
      if (!settings) return;
      const { error } = await supabase
        .from('delivery_settings')
        .update(updates)
        .eq('id', settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-settings'] });
      toast.success('Delivery settings updated');
    },
    onError: (error: any) => {
      toast.error(error.message);
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
      <Card>
        <CardHeader>
          <CardTitle>Delivery Options</CardTitle>
          <CardDescription>
            Control which delivery methods are available to customers during checkout
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between space-x-2">
            <div className="flex items-center space-x-2">
              <Truck className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="shipping" className="text-base">Shipping Delivery</Label>
                <p className="text-sm text-muted-foreground">
                  Allow customers to receive orders via shipping
                </p>
              </div>
            </div>
            <Switch
              id="shipping"
              checked={settings?.shipping_enabled || false}
              onCheckedChange={(checked) =>
                updateMutation.mutate({ shipping_enabled: checked })
              }
              disabled={updateMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between space-x-2">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="pickup" className="text-base">Pickup Option</Label>
                <p className="text-sm text-muted-foreground">
                  Allow customers to pick up orders from designated locations
                </p>
              </div>
            </div>
            <Switch
              id="pickup"
              checked={settings?.pickup_enabled || false}
              onCheckedChange={(checked) =>
                updateMutation.mutate({ pickup_enabled: checked })
              }
              disabled={updateMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
