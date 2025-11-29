import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Button
        variant={language === 'en' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLanguage('en')}
        className="h-8 px-2 text-xs"
      >
        EN
      </Button>
      <Button
        variant={language === 'et' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLanguage('et')}
        className="h-8 px-2 text-xs"
      >
        ET
      </Button>
      <Button
        variant={language === 'uk' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLanguage('uk')}
        className="h-8 px-2 text-xs"
      >
        UK
      </Button>
    </div>
  );
}
