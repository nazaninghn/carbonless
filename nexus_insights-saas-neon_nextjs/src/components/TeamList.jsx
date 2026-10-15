'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/utils/api';
import { roleLabel } from '@/lib/permissions';

// The team, read-only — for managers, who approve the team's entries but do
// not manage members (they used to see only "owners and admins manage the
// team", not who was on it).
export default function TeamList({ tr }) {
  const [members, setMembers] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api.getMemberships()
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (!cancelled) setMembers(Array.isArray(d) ? d : (d?.results || [])); })
      .catch(() => { if (!cancelled) setMembers([]); });
    return () => { cancelled = true; };
  }, []);
  if (members === null) return <p className="text-sm text-[#072C0E]/50">{tr ? 'Yükleniyor…' : 'Loading…'}</p>;
  if (!members.length) return null;
  return (
    <ul className="divide-y divide-[#072C0E]/8 rounded-xl border border-[#072C0E]/10" aria-label={tr ? 'Takım üyeleri' : 'Team members'}>
      {members.filter(m => m.is_active !== false).map(m => (
        <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#072C0E]">{m.full_name || m.user_email}</p>
            {m.full_name && <p className="truncate text-xs text-[#072C0E]/50">{m.user_email}</p>}
          </div>
          <span className="shrink-0 rounded-full bg-[#DEFAE1] px-2.5 py-1 text-[11px] font-bold text-[#175022]">{roleLabel(m.role, tr)}</span>
        </li>
      ))}
    </ul>
  );
}
