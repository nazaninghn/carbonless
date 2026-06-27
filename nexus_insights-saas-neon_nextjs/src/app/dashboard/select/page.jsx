'use client';

import { useEffect } from 'react';

/**
 * Select page is no longer needed — redirect straight to dashboard.
 * The dashboard now has both AI and manual modes accessible via tabs/sidebar.
 */
export default function SelectModePage() {
  useEffect(() => {
    // Set the mode cookie so middleware doesn't loop back here
    document.cookie = 'carbonless_mode_chosen=1; path=/; SameSite=Lax';
    window.location.href = '/dashboard';
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="h-6 w-6 rounded-full border-2 border-[#4CAF50] border-t-transparent animate-spin" />
    </div>
  );
}
