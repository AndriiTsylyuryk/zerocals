import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ShoppingCart, User, LogOut, LayoutDashboard, UtensilsCrossed, Menu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAdmin, loadingAdmin, signOut } = useAuth();
  const { itemCount } = useCart();
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      <Link to="/" onClick={onClick} className="text-foreground hover:text-primary transition-colors">
        {t('nav.home')}
      </Link>
      <Link to="/desserts" onClick={onClick} className="text-foreground hover:text-primary transition-colors">
        {t('nav.desserts')}
      </Link>
      <Link to="/about" onClick={onClick} className="text-foreground hover:text-primary transition-colors">
        {t('nav.about')}
      </Link>
      {user && (
        <Link to="/orders" onClick={onClick} className="text-foreground hover:text-primary transition-colors">
          {t('nav.orders')}
        </Link>
      )}
      {!loadingAdmin && isAdmin && (
        <Link to="/admin" onClick={onClick} className="text-foreground hover:text-primary transition-colors flex items-center gap-1">
          <LayoutDashboard className="h-4 w-4" />
          {t('nav.admin')}
        </Link>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-2xl font-bold text-primary">
              <UtensilsCrossed className="h-6 w-6" />
              ZeroCals
            </Link>
            
            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6">
              <NavLinks />
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
                <div className="hidden md:flex items-center gap-2">
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
                <Link to="/auth" className="hidden md:block">
                  <Button>{t('nav.login')}</Button>
                </Link>
              )}

              {/* Mobile burger menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64">
                  <nav className="flex flex-col gap-4 mt-8">
                    <NavLinks onClick={() => setMobileMenuOpen(false)} />
                    {user ? (
                      <>
                        <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="text-foreground hover:text-primary transition-colors flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {t('nav.profile')}
                        </Link>
                        <button onClick={() => { signOut(); setMobileMenuOpen(false); }} className="text-foreground hover:text-primary transition-colors flex items-center gap-2 text-left">
                          <LogOut className="h-4 w-4" />
                          {t('nav.logout')}
                        </button>
                      </>
                    ) : (
                      <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="text-foreground hover:text-primary transition-colors">
                        {t('nav.login')}
                      </Link>
                    )}
                  </nav>
                </SheetContent>
              </Sheet>
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
