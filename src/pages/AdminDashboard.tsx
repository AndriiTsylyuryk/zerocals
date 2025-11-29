import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminProducts from '@/components/admin/AdminProducts';
import AdminOrders from '@/components/admin/AdminOrders';
import AdminPickupLocations from '@/components/admin/AdminPickupLocations';
import AdminDeliverySettings from '@/components/admin/AdminDeliverySettings';
import AdminAbout from '@/components/admin/AdminAbout';

export default function AdminDashboard() {
  const { isAdmin, loadingAdmin } = useAuth();
  const navigate = useNavigate();

  if (loadingAdmin) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-xl">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-xl mb-4">Access denied. Admin privileges required.</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>

      <Tabs defaultValue="products" className="w-full">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="pickup-locations">Pickup Locations</TabsTrigger>
          <TabsTrigger value="delivery-settings">Delivery Settings</TabsTrigger>
          <TabsTrigger value="about">About Section</TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          <AdminProducts />
        </TabsContent>
        <TabsContent value="orders">
          <AdminOrders />
        </TabsContent>
        <TabsContent value="pickup-locations">
          <AdminPickupLocations />
        </TabsContent>
        <TabsContent value="delivery-settings">
          <AdminDeliverySettings />
        </TabsContent>
        <TabsContent value="about">
          <AdminAbout />
        </TabsContent>
      </Tabs>
    </div>
  );
}
