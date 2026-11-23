/// <reference types="vite/client" />
// SECURITY: Global Privacy Hardening
// Disable console logging outputs IN PRODUCTION to prevent Accidental PII Leakage.
// We keep console.warn and console.error functional for troubleshooting.
if (import.meta.env.PROD) {
  const noop = () => { };
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.table = noop;
}

// SECURITY: Enforce official custom domain to prevent Cloudflare WAF bypass via .web.app or .firebaseapp.com
if (typeof window !== 'undefined') {
  const h = window.location.hostname;
  if (h && (h.includes('.web.app') || h.includes('.firebaseapp.com'))) {
    let target = 'udfonline.in';
    if (h.includes('-admin')) target = 'admin.udfonline.in';
    else if (h.includes('-employee') || h.includes('-emp')) target = 'employee.udfonline.in';
    window.location.replace(`https://${target}${window.location.pathname}${window.location.search}${window.location.hash}`);
  }
}


import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initNativeAppStyles } from './src/utils/capacitor-utils';

// Initialize native app CSS classes for Capacitor
initNativeAppStyles();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from './src/context/AuthContext';
import { DataProvider } from './src/contexts/DataContext';
import { NotificationProvider } from './src/contexts/NotificationContext';

import { APP_VERSION } from './src/constants/version';
import { resilientFetch } from './src/utils/resilientFetch';
import toast, { Toaster } from 'react-hot-toast';


// ─── DUAL-ENGINE ZERO-REFRESH AUTO-UPDATER ───────────────────────────────────
if (typeof window !== 'undefined') {
  let isUpdateReloading = false;
  let initialServerBuildTime: number | null = null;

  // Post-Update Confirmation: If the page reloaded after a version deployment,
  // display a prominent confirmation toast tag confirming they are on the latest build.
  try {
    const postUpdateVer = sessionStorage.getItem('udf_post_update_version');
    if (postUpdateVer) {
      sessionStorage.removeItem('udf_post_update_version');
      setTimeout(() => {
        toast.success(`Updated to latest version! (${postUpdateVer})`, {
          duration: 4500,
          id: 'post-update-success',
        });
      }, 700);
    }
  } catch (_) {}

  const editedElements = new Set<HTMLElement>();

  const isSearchField = (el: HTMLElement): boolean => {
    if (el instanceof HTMLInputElement && el.type === 'search') return true;
    const hint = `${el.getAttribute('placeholder') || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('name') || ''}`;
    return /\bsearch\b/i.test(hint);
  };

  const setEdited = (el: HTMLElement, isDirty: boolean) => {
    if (isDirty) editedElements.add(el);
    else editedElements.delete(el);
  };

  const trackFieldEdit = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || isSearchField(target)) return;

    if (target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'radio')) {
      editedElements.add(target);
      return;
    }
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      setEdited(target, target.value.trim().length > 0);
      return;
    }
    if (target instanceof HTMLSelectElement) {
      editedElements.add(target);
      return;
    }
    if (target.isContentEditable) {
      setEdited(target, (target.textContent || '').trim().length > 0);
    }
  };

  document.addEventListener('input', trackFieldEdit, { capture: true, passive: true });
  document.addEventListener('change', trackFieldEdit, { capture: true, passive: true });
  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      editedElements.forEach((el) => {
        if (form.contains(el)) editedElements.delete(el);
      });
    },
    { capture: true, passive: true }
  );

  const hasOpenModal = (): boolean => {
    const dialogs = document.querySelectorAll(
      '[role="dialog"], [aria-modal="true"], div.fixed.inset-0[class*="z-50"], div.fixed.inset-0[class*="z-[60]"], div.fixed.inset-0[class*="z-[100]"]'
    );
    return Array.from(dialogs).some((el) => !el.classList.contains('pointer-events-none'));
  };

  const hasActiveWorkInProgress = (): boolean => {
    editedElements.forEach((el) => {
      if (!el.isConnected) editedElements.delete(el);
    });

    const activeEl = document.activeElement;
    if (activeEl instanceof HTMLElement) {
      const tag = activeEl.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || activeEl.isContentEditable) {
        return true;
      }
    }

    return hasOpenModal() || editedElements.size > 0;
  };

  const triggerSafeReload = (newVersionLabel = APP_VERSION, force = false) => {
    if (isUpdateReloading) return;

    if (!force && hasActiveWorkInProgress()) {
      // Protect open modals and unsaved form data: show a non-destructive prompt instead of reloading
      if ((window as any).__UDF_UPDATE_PENDING) return;
      (window as any).__UDF_UPDATE_PENDING = true;
      toast(
        (t) => (
          <div className="flex items-center gap-3 py-1">
            <div className="flex flex-col text-left">
              <span className="text-sm font-semibold text-slate-900">New portal update available!</span>
              <span className="text-xs text-slate-500">Save your progress, then click to refresh.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  (window as any).__UDF_UPDATE_PENDING = false;
                }}
                className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 rounded cursor-pointer"
              >
                Later
              </button>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  (window as any).__UDF_UPDATE_PENDING = false;
                  isUpdateReloading = true;
                  try {
                    sessionStorage.setItem('udf_post_update_version', newVersionLabel);
                  } catch (_) {}
                  window.location.reload();
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3.5 py-2 rounded-lg font-bold shadow-md transition-all cursor-pointer whitespace-nowrap active:scale-95"
              >
                Update Now
              </button>
            </div>
          </div>
        ),
        { duration: Infinity, position: 'top-right', id: 'update-available-prompt' }
      );
      return;
    }

    isUpdateReloading = true;
    try {
      sessionStorage.setItem('udf_post_update_version', newVersionLabel);
    } catch (_) {}
    window.location.reload();
  };

  // 1. Service Worker Update Trigger (Employee Portal & Public Site)
  if ('serviceWorker' in navigator) {
    // Only treat controllerchange as an update when replacing an active controller,
    // not on initial clients.claim() in Incognito or first-ever visits.
    let hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      triggerSafeReload(APP_VERSION);
    });

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          reg.update().catch(() => {});
        }
      });
      setInterval(() => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        reg.update().catch(() => {});
      }, 15 * 60 * 1000);
    }).catch(() => {});
  }

  // 2. Dual-Engine Background Probe (Works on Admin Portal where SW is disabled, and across all browsers)
  // PROBLEM 1 FIX: Immune to client clock skew. We compare server buildTime against the initial server buildTime
  // captured on this page's first probe, NEVER against client Date.now().
  // PROBLEM 3 FIX: Uses resilientFetch with single-retry backoff for mobile resilience.
  const checkVersionProbe = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      const res = await resilientFetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || typeof data.buildTime !== 'number') return;

      if (initialServerBuildTime === null) {
        // Record the server's build timestamp active when this tab opened
        initialServerBuildTime = data.buildTime;
        return;
      }

      // If server build time has advanced, a newer deployment is live
      if (data.buildTime > initialServerBuildTime) {
        triggerSafeReload(data.version || APP_VERSION);
      }
    } catch (_) {}
  };

  // Capture initial server build time immediately on page boot
  checkVersionProbe();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkVersionProbe();
    }
  });
  setInterval(checkVersionProbe, 15 * 60 * 1000); // Check every 15 mins

  // 3. Catch Vite lazy-loaded chunk 404s after new deploys (Eliminates white-screen crashes)
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    triggerSafeReload(APP_VERSION, true);
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <DataProvider>
        <NotificationProvider>
          <BrowserRouter>
            <App />
            <Toaster position="top-right" />
          </BrowserRouter>
        </NotificationProvider>
      </DataProvider>
    </AuthProvider>
  </React.StrictMode>
);
