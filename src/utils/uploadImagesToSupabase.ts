// Utility to upload local images to Supabase Storage
// This is used to migrate the generated images to Supabase

import { supabase } from '@/integrations/supabase/client';
import napoleonImg from '@/assets/napoleon.jpg';
import honeyCakeImg from '@/assets/honey-cake.jpg';
import tiramisuImg from '@/assets/tiramisu.jpg';

export async function uploadLocalImagesToSupabase() {
  const images = [
    { name: 'napoleon', url: napoleonImg, productName: 'Low-calorie Napoleon' },
    { name: 'honey-cake', url: honeyCakeImg, productName: 'Low-calorie Honey Cake' },
    { name: 'tiramisu', url: tiramisuImg, productName: 'Low-calorie Tiramisu' },
  ];

  const uploadedUrls: Record<string, string> = {};

  for (const image of images) {
    try {
      // Fetch the image as blob
      const response = await fetch(image.url);
      const blob = await response.blob();
      
      // Create filename
      const fileName = `${image.name}-${Date.now()}.jpg`;
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      uploadedUrls[image.productName] = publicUrl;

      // Update database
      await supabase
        .from('products')
        .update({ image_url: publicUrl })
        .eq('name', image.productName);

    } catch (error) {
      console.error(`Failed to upload ${image.name}:`, error);
    }
  }

  return uploadedUrls;
}
