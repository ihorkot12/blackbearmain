import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ChevronDown, User } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { Button } from './Button';

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const location = useLocation();
  const isMainPage = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenDropdown(null);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    setOpenDropdown(null);
  }, [location.pathname]);

  const navLinks = [
    { name: 'Про клуб', href: '#about' },
    { 
      name: 'Тренування',
      href: '#directions',
      subItems: [
        { name: 'Діти 4-7 років', href: '/kids-4-7' },
        { name: 'Діти 7-12 років', href: '/juniors-7-12' },
        { name: 'Підлітки 12+', href: '/teens-12-plus' },
        { name: 'Карате для дівчат', href: '/women-karate' },
        { name: 'Персональні', href: '/personal-training' },
      ]
    },
    { name: 'Тренери', href: '#coach' },
    { name: 'Розклад', href: '#schedule' },
    { name: 'Контакти', href: '#contact' },
  ];

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (isMainPage && href.startsWith('#')) {
      e.preventDefault();
      const element = document.querySelector(href);
      if (element) {
        const headerOffset = 80;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }
  };

  const getHref = (href: string) => {
    if (!isMainPage && href.startsWith('#')) {
      return `/${href}`;
    }
    return href;
  };

  return (
    <>
      <div className="hidden md:block bg-red-600 text-white py-1 px-4 text-center text-[10px] font-black uppercase tracking-[0.3em] z-[60] relative">
        Шулявська — Сирець
      </div>
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        isScrolled 
          ? 'bg-black/95 backdrop-blur-xl h-[64px] border-b border-amber-500/30 shadow-2xl shadow-black mt-0' 
          : `bg-gradient-to-r from-[#0F0F0F] to-[#1A0000] backdrop-blur-md h-[72px] border-b border-amber-500/10 ${isMainPage ? 'md:mt-6 mt-0' : 'mt-0'}`
      }`}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-full flex items-center justify-between gap-3 overflow-hidden">
          <Link 
            to="/" 
            className="flex w-[112px] sm:w-[170px] md:w-auto shrink-0 items-center overflow-hidden cursor-pointer" 
            onClick={() => {
              if (isMainPage) window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <div className="md:scale-100 sm:scale-75 scale-[0.48] origin-left">
              <BrandLogo size="sm" align="start" />
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center lg:gap-10 md:gap-6">
            {navLinks.map((link) => {
              if (link.subItems) {
                const isDropdownOpen = openDropdown === link.name;
                return (
                  <div
                    key={link.name}
                    className="relative"
                    onMouseEnter={() => setOpenDropdown(link.name)}
                    onMouseLeave={() => setOpenDropdown((current) => current === link.name ? null : current)}
                  >
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={isDropdownOpen}
                      onClick={() => setOpenDropdown(isDropdownOpen ? null : link.name)}
                      className="relative text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-300 flex items-center gap-1 group text-[#EAEAEA] hover:text-red-500"
                    >
                      {link.name}
                      <ChevronDown size={12} className={`transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                      <span className="absolute -bottom-1 left-0 h-[1px] bg-red-600 transition-all duration-300 w-0 group-hover:w-full" />
                    </button>
                    
                    {/* Dropdown Menu */}
                    <div
                      className={`absolute top-full left-1/2 -translate-x-1/2 pt-4 transition-all duration-200 z-50 ${isDropdownOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-2'}`}
                    >
                      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-2 min-w-[200px] shadow-2xl backdrop-blur-xl">
                        {link.subItems.map((sub) => (
                          <Link 
                            key={sub.name}
                            to={sub.href}
                            onClick={() => setOpenDropdown(null)}
                            className="block px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-red-600/10 rounded-xl transition-all"
                          >
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <Link 
                  key={link.name} 
                  to={getHref(link.href)}
                  onClick={(e) => handleAnchorClick(e, link.href)}
                  className="relative text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-300 group text-[#EAEAEA] hover:text-red-500"
                >
                  {link.name}
                  <span className="absolute -bottom-1 left-0 h-[1px] bg-red-600 transition-all duration-300 w-0 group-hover:w-full" />
                </Link>
              );
            })}
            <Link to="/login" className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#EAEAEA] hover:text-red-500 transition-all duration-300 flex items-center gap-2">
              <User size={14} />
              Вхід
            </Link>
            <Button 
              variant="primary" 
              className="h-[48px] px-8 text-[11px]" 
              onClick={() => {
                const contactSection = document.getElementById('contact');
                if (contactSection) {
                  contactSection.scrollIntoView({ behavior: 'smooth' });
                } else if (!isMainPage) {
                  window.location.href = '/#contact';
                }
              }}
            >
              Записатись
            </Button>
          </div>

          <div className="flex items-center gap-2 lg:hidden shrink-0">
            <button 
              className="bg-red-600 text-white text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-3 sm:px-4 py-2.5 rounded-xl shadow-[0_4px_12px_rgba(220,38,38,0.4)] active:scale-95 transition-transform"
              onClick={() => {
                const contactSection = document.getElementById('contact');
                if (contactSection) {
                  contactSection.scrollIntoView({ behavior: 'smooth' });
                } else if (!isMainPage) {
                  window.location.href = '/#contact';
                }
              }}
            >
              ЗАПИС
            </button>
            <button 
              className="text-white p-2.5 bg-white/5 rounded-xl border border-white/10 active:bg-white/10 transition-colors" 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] bg-black/98 backdrop-blur-2xl lg:hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-6 h-[72px] border-b border-white/5">
              <BrandLogo size="sm" align="start" />
              <button 
                className="text-white p-2.5 bg-white/5 rounded-xl border border-white/10" 
                onClick={() => setIsMenuOpen(false)}
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-8 px-6">
              <div className="flex flex-col gap-6">
                {navLinks.map((link, idx) => {
                  if (link.subItems) {
                    return (
                      <div key={link.name} className="space-y-4">
                        <div className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em] px-2">{link.name}</div>
                        <div className="grid grid-cols-1 gap-2">
                          {link.subItems.map(sub => (
                            <Link 
                              key={sub.name}
                              to={sub.href}
                              onClick={() => setIsMenuOpen(false)}
                              className="px-4 py-4 bg-white/5 rounded-2xl text-lg font-bold text-white active:bg-red-600 transition-colors flex items-center justify-between group"
                            >
                              {sub.name}
                              <ChevronDown size={16} className="-rotate-90 text-zinc-600 group-active:text-white" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <Link 
                      key={link.name}
                      to={getHref(link.href)}
                      onClick={(e) => {
                        handleAnchorClick(e, link.href);
                        setIsMenuOpen(false);
                      }}
                      className="px-4 py-5 bg-white/5 rounded-2xl text-2xl font-black text-white uppercase tracking-tight active:bg-red-600 transition-colors"
                    >
                      {link.name}
                    </Link>
                  );
                })}
                
                <Link 
                  to="/login" 
                  onClick={() => setIsMenuOpen(false)}
                  className="px-4 py-5 bg-white/5 rounded-2xl text-xl font-bold text-white uppercase tracking-tight flex items-center gap-4 active:bg-red-600 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <User size={20} />
                  </div>
                  Вхід в кабінет
                </Link>
              </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-black/50">
              <Button 
                variant="primary" 
                className="w-full h-[64px] text-sm font-black uppercase tracking-widest"
                onClick={() => {
                  setIsMenuOpen(false);
                  const contactSection = document.getElementById('contact');
                  if (contactSection) {
                    contactSection.scrollIntoView({ behavior: 'smooth' });
                  } else if (!isMainPage) {
                    window.location.href = '/#contact';
                  }
                }}
              >
                Записатися на тренування
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
