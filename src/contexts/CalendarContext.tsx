import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';
import type { Calendar } from '../../packages/types/dist';

interface CalendarContextType {
  calendars: Calendar[];
  calendarMap: { [key: string]: Calendar };
  refetchCalendars: () => Promise<void>;
}

const CalendarContext = createContext<CalendarContextType>({
  calendars: [],
  calendarMap: {},
  refetchCalendars: async () => {},
});

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [calendars, setCalendars] = useState<Calendar[]>([]);

  const refetchCalendars = async () => {
    if (!user?.locationId) return;
    try {
      const res = await api.get('/api/locations/byLocation', {
        params: { locationId: user.locationId },
      });
      if (res.data && Array.isArray(res.data.calendars)) {
        setCalendars(res.data.calendars);
      } else {
        setCalendars([]);
      }
    } catch (e) {
      setCalendars([]);
      console.error('Failed to fetch calendars:', e);
    }
  };

  useEffect(() => {
    refetchCalendars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.locationId]);

  const calendarMap = useMemo(
    () => Object.fromEntries((calendars || []).map(c => [c.id || c.calendarId, c])),
    [calendars]
  );

  return (
    <CalendarContext.Provider value={{ calendars, calendarMap, refetchCalendars }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  return useContext(CalendarContext);
}
