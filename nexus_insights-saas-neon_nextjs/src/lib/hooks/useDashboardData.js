'use client';
import { useEffect, useCallback, useReducer, useRef } from 'react';
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
      // First load → show spinner; subsequent → set refreshing silently
      if (state.loading) return state;                      // already loading — no new object
      return { ...state, refreshing: true };
    case 'SET_UNREAD':
      return { ...state, unreadCount: action.payload };
    default:
      return state;
  }
}

export function useDashboardData(selectedYear) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const isFirstLoad = useRef(true);
  // Generation counter: incremented on every new fetch start and on unmount.
  // Any in-flight fetch that completes after the counter has moved is discarded,
  // preventing stale dispatches onto an unmounted or re-rendered reducer.
  const fetchGen = useRef(0);

  // Stable setter so consumers can optimistically update the badge count
  const setUnreadCount = useCallback(
    (count) => dispatch({ type: 'SET_UNREAD', payload: count }),
    [],
  );

  const fetchData = useCallback(async () => {
    const thisGen = ++fetchGen.current;
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

      // Discard if another fetch started (year changed) or component unmounted
      if (thisGen !== fetchGen.current) return;

      const summaryData  = await parseRes(summaryRes);
      const profileData  = await parseRes(profileRes);
      const notifData    = await parseRes(notifRes);
      const entriesData  = await parseList(entriesRes);
      const factorsData  = await parseList(factorsRes);
      const targetsData  = await parseList(targetsRes);
      const customData   = await parseList(customRes);
      const facilityData = await parseList(facilityRes);

      if (thisGen !== fetchGen.current) return; // check again after async parsing

      const newUnread = notifData?.unread_count || 0;

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
    } catch {
      if (thisGen !== fetchGen.current) return; // stale — ignore
      if (isFirstLoad.current) {
        dispatch({ type: 'LOADED', payload: {} }); // stop spinner on first-load failure
        isFirstLoad.current = false;               // prevent re-running as "first load" on retry
      }
      // background refresh errors: silently ignore — keep existing data visible
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
    // Incrementing the generation on cleanup means any response still in-flight
    // from this render cycle will be ignored once the effect re-runs or unmounts.
    return () => { fetchGen.current++; };
  }, [fetchData]);

  return {
    ...state,       // includes state.unreadCount
    setUnreadCount,
    fetchData,
  };
}
