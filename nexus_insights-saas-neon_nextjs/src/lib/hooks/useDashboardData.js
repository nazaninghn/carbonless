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
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
        if (data.questionnaire_profile) setQuestionnaireProfile(data.questionnaire_profile);
      }
      if (entriesRes.ok) {
        const data = await entriesRes.json();
        setEntries(Array.isArray(data) ? data : data.results || []);
      }
      if (factorsRes.ok) {
        const data = await factorsRes.json();
        setFactors(Array.isArray(data) ? data : data.results || []);
      }
      if (targetsRes.ok) {
        const data = await targetsRes.json();
        setTargets(Array.isArray(data) ? data : data.results || []);
      }
      if (profileRes.ok) setUser(await profileRes.json());
      if (customRes.ok) {
        const data = await customRes.json();
        setCustomRequests(Array.isArray(data) ? data : data.results || []);
      }
      if (notifRes.ok) {
        const data = await notifRes.json();
        setUnreadCount(data.unread_count || 0);
      }
      if (facilityRes.ok) {
        const data = await facilityRes.json();
        setFacilityList(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { window.location.href = '/login'; return; }
    fetchData();
  }, [fetchData]);

  return {
    user, summary, entries, factors, targets, customRequests,
    questionnaireProfile, unreadCount, facilityList, loading,
    setUnreadCount, fetchData,
  };
}
