import { Heart, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function About() {
  const { t } = useLanguage();

  const { data: aboutContent, isLoading } = useQuery({
    queryKey: ['about-content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('about_content')
        .select('*')
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold mb-4">{aboutContent?.title || t('about.title')}</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Creating delicious, guilt-free desserts for health-conscious sweet lovers
        </p>
      </div>

      {/* Main Content Section */}
      <div className="max-w-4xl mx-auto mb-16">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="order-2 md:order-1">
            <div className="prose prose-lg">
              <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                {aboutContent?.content || t('about.missionText')}
              </div>
            </div>
          </div>
          <div className="order-1 md:order-2">
            {aboutContent?.image_url ? (
              <div className="aspect-square rounded-lg overflow-hidden">
                <img 
                  src={aboutContent.image_url} 
                  alt={aboutContent.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="aspect-square bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center">
                <div className="text-center p-8">
                  <Heart className="h-24 w-24 mx-auto mb-4 text-primary" />
                  <p className="text-muted-foreground">
                    Add your photo in the admin panel
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
