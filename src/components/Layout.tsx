import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ShoppingCart, User, LogOut, LayoutDashboard, UtensilsCrossed } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAdmin, loadingAdmin, signOut } = useAuth();
  const { itemCount } = useCart();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-2xl font-bold text-primary">
              <UtensilsCrossed className="h-6 w-6" />
              ZeroCals
            </Link>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/" className="text-foreground hover:text-primary transition-colors">
                {t('nav.home')}
              </Link>
              <Link to="/desserts" className="text-foreground hover:text-primary transition-colors">
                {t('nav.desserts')}
              </Link>
              <Link to="/about" className="text-foreground hover:text-primary transition-colors">
                {t('nav.about')}
              </Link>
              {user && (
                <Link to="/orders" className="text-foreground hover:text-primary transition-colors">
                  {t('nav.orders')}
                </Link>
              )}
              {!loadingAdmin && isAdmin && (
                <Link to="/admin" className="text-foreground hover:text-primary transition-colors flex items-center gap-1">
                  <LayoutDashboard className="h-4 w-4" />
                  {t('nav.admin')}
                </Link>
              )}
            </nav>

            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <Link to="/cart">
                <Button variant="ghost" size="icon" className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {itemCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {itemCount}
                    </Badge>
                  )}
                </Button>
              </Link>
              
              {user ? (
                <div className="flex items-center gap-2">
                  <Link to="/profile">
                    <Button variant="ghost" size="icon">
                      <User className="h-5 w-5" />
                    </Button>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={signOut}>
                    <LogOut className="h-5 w-5" />
                  </Button>
                </div>
              ) : (
                <Link to="/auth">
                  <Button>{t('nav.login')}</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t bg-card mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          © 2024 ZeroCals. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
