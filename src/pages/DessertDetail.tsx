import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function DessertDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { t } = useLanguage();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      image_url: product.image_url,
    });
    toast.success(`${product.name} added to cart`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-xl text-muted-foreground mb-4">{t('detail.notFound')}</p>
        <Button onClick={() => navigate('/desserts')}>{t('detail.backToDesserts')}</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => navigate('/desserts')}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('detail.backToDesserts')}
      </Button>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-96 object-cover rounded-lg shadow-lg"
            />
          ) : (
            <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">{t('detail.noImage')}</p>
            </div>
          )}
        </div>

        <div>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-3xl mb-2">{product.name}</CardTitle>
                  <CardDescription className="text-lg">
                    <span className="calories-rainbow">{product.calories} {t('desserts.calories')}</span> {t('detail.perServing')}
                  </CardDescription>
                </div>
                {product.is_featured && (
                  <Badge variant="default">{t('detail.popular')}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                {product.description}
              </p>
              
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">{t('detail.nutritionalInfo')}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('desserts.calories')}:</span>
                    <span className="ml-2 calories-rainbow">{product.calories}</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 flex items-center justify-between">
                <span className="text-3xl font-bold text-primary">
                  €{Number(product.price).toFixed(2)}
                </span>
              </div>
            </CardContent>
            <CardFooter>
              <Button size="lg" className="w-full" onClick={handleAddToCart}>
                {t('desserts.addToCart')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
