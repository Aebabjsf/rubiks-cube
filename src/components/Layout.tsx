import { Outlet, Link, useLocation } from 'react-router-dom';
import { useThemeStore } from '../store';
import { useAuthStore } from '../store/authStore';
import { Moon, Sun, Box, Menu, X, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

export function Layout() {
  const { isDark, toggleTheme } = useThemeStore();
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { path: '/', label: 'О кубике' },
    { path: '/tutorial', label: 'Обучение' },
    { path: '/simulation', label: '3D Симуляция' },
    { path: '/online', label: 'Дуэли' },
    { path: '/profile', label: 'Кабинет' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-brand-50/80 dark:bg-brand-900/80 backdrop-blur-lg border-b border-brand-400/20 text-brand-900 dark:text-brand-50 shadow-sm transition-colors duration-500">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 font-extrabold text-xl hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-500 flex items-center justify-center shadow-lg shadow-brand-400/30">
              <Box className="w-6 h-6 text-brand-50" />
            </div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-800 to-brand-500 dark:from-brand-50 dark:to-brand-400 tracking-tight">
              Rubik's World
            </span>
          </Link>
          
          {/* Desktop Nav */}
          <nav className="hidden md:flex gap-2">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path));
              return (
                <Link 
                  key={link.path}
                  to={link.path} 
                  className={`relative px-4 py-2 text-sm font-semibold transition-colors uppercase tracking-wider rounded-lg ${isActive ? 'text-brand-900 dark:text-brand-50' : 'text-brand-800/70 dark:text-brand-50/70 hover:text-brand-500 dark:hover:text-brand-400'}`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavIndicator"
                      className="absolute inset-0 bg-brand-400/20 dark:bg-brand-500/30 rounded-lg -z-10"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  {link.label}
                </Link>
              );
            })}
          </nav>
          
          <div className="flex items-center gap-2">
            {/* Quick Profile / Auth Pill Button */}
            <Link
              to="/profile"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                isAuthenticated
                  ? 'bg-gradient-to-r from-brand-500/20 to-brand-400/20 text-brand-900 dark:text-brand-100 border-brand-400/40 hover:border-brand-400 shadow-sm'
                  : 'bg-brand-400/10 hover:bg-brand-400/20 text-brand-800 dark:text-brand-50 border-brand-400/20 active:scale-95'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                {isAuthenticated ? ((user?.profile?.nickname || user?.username || 'U')[0].toUpperCase()) : <User className="w-3 h-3" />}
              </div>
              <span className="hidden sm:inline">
                {isAuthenticated ? (user?.profile?.nickname || user?.username) : 'Войти'}
              </span>
            </Link>

            <button 
              onClick={toggleTheme}
              className="p-2.5 rounded-full bg-brand-400/10 hover:bg-brand-400/20 text-brand-800 dark:text-brand-50 transition-all active:scale-95 cursor-pointer"
              aria-label="Переключить тему"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2.5 rounded-full bg-brand-400/10 hover:bg-brand-400/20 text-brand-800 dark:text-brand-50 transition-all active:scale-95"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Nav Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden bg-brand-50/95 dark:bg-brand-900/95 backdrop-blur-lg border-b border-brand-400/20"
            >
              <nav className="flex flex-col p-4 gap-2">
                {navLinks.map((link) => {
                  const isActive = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path));
                  return (
                    <Link 
                      key={link.path}
                      to={link.path} 
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`px-4 py-3 text-base font-bold transition-colors uppercase tracking-wider rounded-xl ${isActive ? 'bg-brand-400/20 dark:bg-brand-500/30 text-brand-900 dark:text-brand-50' : 'text-brand-800/70 dark:text-brand-50/70 hover:bg-brand-400/10'}`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-grow relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="bg-brand-900 text-brand-50/70 py-6 text-center text-sm z-10 relative">
        <div className="container mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} Rubik's World. Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
}

