// Updated: 2025-06-17
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { locationService } from '../services/locationService';
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
    
    console.log('Fetching calendars for locationId:', user.locationId);
    
    try {
      const locationData = await locationService.getDetails(user.locationId);
      if (locationData && Array.isArray(locationData.calendars)) {
        setCalendars(locationData.calendars);
      } else {
        setCalendars([]);
      }
    } catch (e) {
      setCalendars([]);
      console.error('Failed to fetch calendars:', e);
      
      // Add detailed error logging
      if (e.response) {
        console.error('Error status:', e.response.status);
        console.error('Error data:', e.response.data);
      }
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