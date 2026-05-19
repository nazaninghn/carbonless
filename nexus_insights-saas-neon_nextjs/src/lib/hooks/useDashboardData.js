'use client';
import { useState, useEffect, useCallback, useReducer } from 'react';
import { api } from '@/lib/utils/api';

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

  const parseRes = async (res) => {
    if (!res || !res.ok) return null;
    try { return await res.json(); } catch { return null; }
  };

  const parseList = async (res) => {
    const data = await parseRes(res);
    if (!data) return [];
    return Array.isArray(data) ? data : data.results || [];
  };

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
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      dispatch({ type: 'LOADED', payload: {} }); // clear loading even on error
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
