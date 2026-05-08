'use client';
import { useEffect } from 'react';

export default function DashboardLayout({ children }) {
  useEffect(() => {
    // Replace current history entry so there's nothing to go back to
    window.history.replaceState(null, '', window.location.href);

    // Continuously block back navigation
    const blockBack = () => {
      window.history.pushState(null, '', window.location.href);
    };

    // Push multiple states to create a buffer
    window.history.pushState(null, '', window.location.href);
    window.history.pushState(null, '', window.location.href);
    window.history.pushState(null, '', window.location.href);

    window.addEventListener('popstate', blockBack);

    // Also block beforeunload (closing tab / navigating away)
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', blockBack);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return children;
}
