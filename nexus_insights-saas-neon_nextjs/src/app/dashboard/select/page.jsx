'use client';

import { useEffect } from 'react';

// The "AI or Dashboard" choice after sign-in was removed: the app opens on
// the Carbon Inventory, with the AI assistant beside it. Old links and
// bookmarks to this page land there too.
export default function SelectModePage() {
  useEffect(() => {
    try { localStorage.setItem('carbonless_startup_mode', 'inventory'); } catch {}
    document.cookie = 'carbonless_mode_chosen=1; path=/; SameSite=Lax';
    window.location.replace('/dashboard');
  }, []);
  return (
    <div className="min-h-screen bg-[#F1FCF2] flex items-center justify-center">
      <div className="h-6 w-6 rounded-full border-2 border-[#2ABD41] border-t-transparent animate-spin" />
    </div>
  );
}
