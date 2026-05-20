'use client';
import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import { api } from '@/lib/utils/api';

async function parseRes(res) {
  if (!res || !res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

async function parseList(res) {
  const data = await parseRes(res);
  if (!data) return [];
  return Array.isArray(data) ? data : data.results || [];
}

const initialState = {
  user: null,
  summary: null,
  entries: [],
  factors: [],
  targets: [],
  customRequests: [],
  questionnaireProfile: null,
  unreadCount: 0,
  facilityList: [],
  loading: true,       // true only on first load
  refreshing: false,   // true on subsequent refreshes (no UI flash)
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOADED':
      return { ...state, ...action.payload, loading: false, refreshing: false };
    case 'LOADING':
      // First load → show loading; subsequent → just set refreshing silently
      return state.loading
        ? { ...state, loading: true }
        : { ...state, refreshing: true };
    default:
      return state;
  }
}

export function useDashboardData(selectedYear) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [unreadCount, setUnreadCount] = useState(0);
  const isFirstLoad = useRef(true);

  const fetchData = useCallback(async () => {
    dispatch({ type: 'LOADING' });
    try {
      const [summaryRes, entriesRes, factorsRes, targetsRes, profileRes,
             customRes, notifRes, facilityRes] = await Promise.all([
        api.getSummary(selectedYear),
        api.getEntries(`year=${selectedYear}`),
        api.getFactors(),
        api.getTargets(),
        api.getProfile(),
        api.getCustomRequests(),
        api.getUnreadCount(),
        api.getFacilities(),
      ]);

      const summaryData  = await parseRes(summaryRes);
      const profileData  = await parseRes(profileRes);
      const notifData    = await parseRes(notifRes);
      const entriesData  = await parseList(entriesRes);
      const factorsData  = await parseList(factorsRes);
      const targetsData  = await parseList(targetsRes);
      const customData   = await parseList(customRes);
      const facilityData = await parseList(facilityRes);

      const newUnread = notifData?.unread_count || 0;
      setUnreadCount(newUnread);

      // Single dispatch → single re-render
      dispatch({
        type: 'LOADED',
        payload: {
          summary:              summaryData || null,
          questionnaireProfile: summaryData?.questionnaire_profile || null,
          entries:              entriesData,
          factors:              factorsData,
          targets:              targetsData,
          customRequests:       customData,
          facilityList:         facilityData,
          user:                 profileData || null,
          unreadCount:          newUnread,
        },
      });
      isFirstLoad.current = false;
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      if (isFirstLoad.current) {
        dispatch({ type: 'LOADED', payload: {} }); // stop spinner on first-load failure
        isFirstLoad.current = false;               // prevent re-running as "first load" on retry
      }
      // background refresh errors: silently ignore — keep existing data visible
    }
  }, [selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return {
    ...state,
    unreadCount,
    setUnreadCount,
    fetchData,
  };
}
