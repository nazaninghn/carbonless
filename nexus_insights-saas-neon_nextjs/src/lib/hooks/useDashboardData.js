'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/utils/api';

export function useDashboardData(selectedYear) {
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [factors, setFactors] = useState([]);
  const [targets, setTargets] = useState([]);
  const [customRequests, setCustomRequests] = useState([]);
  const [questionnaireProfile, setQuestionnaireProfile] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [facilityList, setFacilityList] = useState([]);
  const [loading, setLoading] = useState(true);

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
    setLoading(true);
    try {
      const [summaryRes, entriesRes, factorsRes, targetsRes, profileRes, customRes, notifRes, facilityRes] = await Promise.all([
        api.getSummary(selectedYear),
        api.getEntries(`year=${selectedYear}`),
        api.getFactors(),
        api.getTargets(),
        api.getProfile(),
        api.getCustomRequests(),
        api.getUnreadCount(),
        api.getFacilities(),
      ]);

      const summaryData = await parseRes(summaryRes);
      if (summaryData) {
        setSummary(summaryData);
        if (summaryData.questionnaire_profile) setQuestionnaireProfile(summaryData.questionnaire_profile);
      }
      setEntries(await parseList(entriesRes));
      setFactors(await parseList(factorsRes));
      setTargets(await parseList(targetsRes));
      setCustomRequests(await parseList(customRes));
      setFacilityList(await parseList(facilityRes));

      const profileData = await parseRes(profileRes);
      if (profileData) setUser(profileData);

      const notifData = await parseRes(notifRes);
      if (notifData) setUnreadCount(notifData.unread_count || 0);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return {
    user, summary, entries, factors, targets, customRequests,
    questionnaireProfile, unreadCount, facilityList, loading,
    setUnreadCount, fetchData,
  };
}
