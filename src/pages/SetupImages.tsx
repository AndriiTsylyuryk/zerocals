import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import napoleonImg from '@/assets/napoleon.jpg';
import honeyCakeImg from '@/assets/honey-cake.jpg';
import tiramisuImg from '@/assets/tiramisu.jpg';

export default function SetupImages() {
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);

  const images = [
    { name: 'napoleon', url: napoleonImg, productName: 'Low-calorie Napoleon' },
    { name: 'honey-cake', url: honeyCakeImg, productName: 'Honey Cake/Медовик' },
    { name: 'tiramisu', url: tiramisuImg, productName: 'Low-calorie Tiramisu' },
  ];

  const handleUpload = async () => {
    setUploading(true);
    setProgress([]);
    
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to migrate images');
      }

      // Fetch all products with local image paths
      const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('id, name, image_url')
        .like('image_url', '/src/assets/%');

      if (fetchError) throw fetchError;
      if (!products || products.length === 0) {
        toast.info('No images need migration');
        setDone(true);
        return;
      }

      setProgress(prev => [...prev, `Found ${products.length} products to migrate`]);

      // Process each product
      for (const product of products) {
        const imageInfo = images.find(img => product.name.includes(img.productName));
        if (!imageInfo) {
          setProgress(prev => [...prev, `⚠️ Skipping ${product.name} - no matching image`]);
          continue;
        }

        setProgress(prev => [...prev, `Uploading ${product.name}...`]);

        // Fetch the image and convert to base64
        const response = await fetch(imageInfo.url);
        const blob = await response.blob();
        const reader = new FileReader();
        
        const base64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        // Call edge function to migrate
        const { data, error } = await supabase.functions.invoke('migrate-product-images', {
          body: {
            productId: product.id,
            imageBase64: base64,
            fileName: `${imageInfo.name}.jpg`,
          },
        });

        if (error) {
          setProgress(prev => [...prev, `❌ Failed: ${product.name} - ${error.message}`]);
        } else {
          setProgress(prev => [...prev, `✓ Migrated ${product.name}`]);
        }
      }

      toast.success('Image migration completed!');
      setDone(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to migrate images');
      setProgress(prev => [...prev, `❌ Error: ${error.message}`]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Migrate Product Images</CardTitle>
          <CardDescription>
            Automatically migrate product images from local assets to Supabase Storage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <p className="text-green-600 font-medium mb-2">Migration completed successfully!</p>
              <p className="text-sm text-muted-foreground">
                All product images have been uploaded to Supabase Storage and database records updated.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm">
                  This will automatically:
                </p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1 text-muted-foreground">
                  <li>Find all products with local image paths (/src/assets/)</li>
                  <li>Upload images to Supabase Storage</li>
                  <li>Update product records with public URLs</li>
                  <li>Make images work in production</li>
                </ul>
              </div>
              
              <Button 
                onClick={handleUpload} 
                disabled={uploading}
                className="w-full"
                size="lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Migrating Images...
                  </>
                ) : (
                  'Start Migration'
                )}
              </Button>
            </>
          )}

          {progress.length > 0 && (
            <div className="mt-6 p-4 bg-muted rounded-lg max-h-96 overflow-y-auto">
              <h3 className="font-medium mb-2">Migration Progress:</h3>
              <div className="space-y-1 text-sm font-mono">
                {progress.map((msg, idx) => (
                  <div key={idx} className="text-muted-foreground">{msg}</div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
