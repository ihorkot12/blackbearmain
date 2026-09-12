/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';

const AdminPage = lazy(() => import('./Admin').then(m => ({ default: m.AdminPage })));
const LoginPage = lazy(() => import('./Admin').then(m => ({ default: m.LoginPage })));
const ParentPanel = lazy(() => import('./ParentPanel'));
const ParentProfile = lazy(() => import('./CRM').then(m => ({ default: m.ParentProfile })));
const KidsLanding = lazy(() => import('./KidsLanding').then(m => ({ default: m.KidsLanding })));
const JuniorLanding = lazy(() => import('./JuniorLanding').then(m => ({ default: m.JuniorLanding })));
const TeenLanding = lazy(() => import('./TeenLanding').then(m => ({ default: m.TeenLanding })));
const PersonalLanding = lazy(() => import('./PersonalLanding').then(m => ({ default: m.PersonalLanding })));
const WomenLanding = lazy(() => import('./WomenLanding').then(m => ({ default: m.WomenLanding })));
const RegisterMember = lazy(() => import('./RegisterMember').then(m => ({ default: m.RegisterMember })));
const Encyclopedia = lazy(() => import('./Encyclopedia'));
const Portal = lazy(() => import('./Portal').then(m => ({ default: m.Portal })));

import { MainLanding } from './MainLanding';


declare global {
  interface Window {
    fbq: any;
  }
}

// --- Components ---

const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // Force scroll to top on refresh or path change
    if (window.history.scrollRestoration) {
      window.history.scrollRestoration = 'manual';
    }
    
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [pathname, hash]);

  return null;
};

const PixelManager = ({ content }: { content: any }) => {
  useEffect(() => {
    if (!content) return;

    const injectScript = (code: string | undefined, id: string) => {
      if (!code || typeof code !== 'string' || code.trim().length === 0) return [];
      
      const elements: HTMLElement[] = [];
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = code;
      
      const scripts = tempDiv.querySelectorAll('script');
      if (scripts.length > 0) {
        scripts.forEach((s, idx) => {
          const scriptId = `${id}-script-${idx}`;
          if (document.getElementById(scriptId)) return;
          const newScript = document.createElement('script');
          newScript.id = scriptId;
          newScript.dataset.bbPixelManager = id;
          if (s.src) {
            newScript.src = s.src;
            newScript.async = s.async;
          } else {
            newScript.innerHTML = s.innerHTML;
          }
          document.head.appendChild(newScript);
          elements.push(newScript);
        });
      } else if (code.trim().length > 0) {
        if (tempDiv.children.length === 0) {
          const script = document.createElement('script');
          script.id = id;
          script.innerHTML = code;
          document.head.appendChild(script);
          elements.push(script);
        }
      }
      
      const noscripts = tempDiv.querySelectorAll('noscript');
      noscripts.forEach((ns, idx) => {
        const noscriptId = `${id}-noscript-${idx}`;
        if (document.getElementById(noscriptId)) return;
        const newNoScript = document.createElement('noscript');
        newNoScript.id = noscriptId;
        newNoScript.dataset.bbPixelManager = id;
        newNoScript.innerHTML = ns.innerHTML;
        document.body.appendChild(newNoScript);
        elements.push(newNoScript);
      });

      return elements;
    };

    const googleElements = injectScript(content?.google_pixel_code, 'google-pixel');
    const metaElements = injectScript(content?.meta_pixel_code, 'meta-pixel');

    return () => {
      [...googleElements, ...metaElements].forEach(el => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
    };
  }, [content?.google_pixel_code, content?.meta_pixel_code]);

  return null;
};

// --- Main App ---

export default function App() {
  const [content, setContent] = useState<any>(() => {
    const cached = sessionStorage.getItem('site_init_data');
    if (cached) {
      try {
        return JSON.parse(cached).content || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const location = useLocation();

  useEffect(() => {
    fetch(`/api/init?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setContent(data.content || null);
          // Save to session storage for other components
          sessionStorage.setItem('site_init_data', JSON.stringify(data));
        }
      })
      .catch(() => {});
  }, []);

  const isAdminPage = location.pathname.startsWith('/admin') || 
                      location.pathname.startsWith('/dashboard') || 
                      location.pathname.startsWith('/login');

  return (
    <>
      <ScrollToTop />
      <PixelManager content={content} />
      <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>}>
        <Routes>
          <Route path="/" element={<MainLanding initialContent={content} />} />
          <Route path="/login" element={<Portal />} />
          <Route path="/portal" element={<Portal />} />
          <Route path="/auth" element={<LoginPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/parent" element={<ParentPanel />} />
          <Route path="/dashboard" element={<AdminPage />} />
          <Route path="/profile" element={<ParentProfile />} />
          <Route path="/kids-4-7" element={<KidsLanding />} />
          <Route path="/juniors-7-12" element={<JuniorLanding />} />
          <Route path="/teens-12-plus" element={<TeenLanding />} />
          <Route path="/personal-training" element={<PersonalLanding />} />
          <Route path="/women-karate" element={<WomenLanding />} />
          <Route path="/register-member" element={<RegisterMember />} />
          <Route path="/encyclopedia" element={<Encyclopedia />} />
        </Routes>
      </Suspense>
    </>
  );
}
