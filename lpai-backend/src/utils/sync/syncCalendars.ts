// src/utils/sync/syncCalendars.ts
import axios from 'axios';
import { Db } from 'mongodb';
import { getAuthHeader } from '../ghlAuth';

export async function syncCalendars(db: Db, location: any) {
  const startTime = Date.now();
  console.log(`[Sync Calendars] Starting for ${location.locationId}`);

  try {
    // Get auth header (OAuth or API key)
    const auth = await getAuthHeader(location);
    
    // Fetch calendars from GHL
    const response = await axios.get(
      'https://services.leadconnectorhq.com/calendars/',
      {
        headers: {
          'Authorization': auth.header,
          'Version': '2021-04-15',  // Calendars use older version
          'Accept': 'application/json'
        },
        params: {
          locationId: location.locationId
        }
      }
    );

    const calendars = response.data.calendars || [];
    console.log(`[Sync Calendars] Found ${calendars.length} calendars`);

    // Transform calendar data to match our schema
    const transformedCalendars = calendars.map((calendar: any) => ({
      id: calendar.id,
      name: calendar.name,
      description: calendar.description || '',
      
      // Calendar Configuration
      locationId: calendar.locationId,
      groupId: calendar.groupId || '',
      teamMembers: calendar.teamMembers || [],
      
      // Event Settings
      eventType: calendar.eventType || 'RoundRobin_OptimizeForAvailability',
      eventTitle: calendar.eventTitle || '{{contact.name}}',
      eventColor: calendar.eventColor || '#039BE5',
      
      // Scheduling Settings
      slotDuration: calendar.slotDuration || 30,
      slotDurationUnit: calendar.slotDurationUnit || 'mins',
      slotInterval: calendar.slotInterval || 30,
      slotIntervalUnit: calendar.slotIntervalUnit || 'mins',
      slotBuffer: calendar.slotBuffer || 0,
      slotBufferUnit: calendar.slotBufferUnit || 'mins',
      preBuffer: calendar.preBuffer || 0,
      preBufferUnit: calendar.preBufferUnit || 'mins',
      appoinmentPerSlot: calendar.appoinmentPerSlot || 1,
      appoinmentPerDay: calendar.appoinmentPerDay || '',
      
      // Availability
      openHours: calendar.openHours || [],
      
      // Booking Settings
      allowBookingAfter: calendar.allowBookingAfter || 0,
      allowBookingAfterUnit: calendar.allowBookingAfterUnit || 'days',
      allowBookingFor: calendar.allowBookingFor || 60,
      allowBookingForUnit: calendar.allowBookingForUnit || 'days',
      
      // Features
      enableRecurring: calendar.enableRecurring || false,
      recurring: calendar.recurring || {},
      autoConfirm: calendar.autoConfirm !== false,  // Default true
      googleInvitationEmails: calendar.googleInvitationEmails || false,
      allowReschedule: calendar.allowReschedule !== false,  // Default true
      allowCancellation: calendar.allowCancellation !== false,  // Default true
      
      // Form & Widget
      widgetSlug: calendar.widgetSlug || '',
      widgetType: calendar.widgetType || 'default',
      formId: calendar.formId || '',
      formSubmitType: calendar.formSubmitType || 'ThankYouMessage',
      formSubmitRedirectUrl: calendar.formSubmitRedirectUrl || '',
      formSubmitThanksMessage: calendar.formSubmitThanksMessage || 'Thank you for your appointment request.',
      
      // Additional Settings
      notes: calendar.notes || '',
      pixelId: calendar.pixelId || '',
      guestType: calendar.guestType || 'collect_detail',
      consentLabel: calendar.consentLabel || 'I confirm that I want to receive content from this company using any contact information I provide.',
      calendarCoverImage: calendar.calendarCoverImage || '',
      stickyContact: calendar.stickyContact || false,
      isLivePaymentMode: calendar.isLivePaymentMode || false,
      shouldAssignContactToTeamMember: calendar.shouldAssignContactToTeamMember || false,
      shouldSkipAssigningContactForExisting: calendar.shouldSkipAssigningContactForExisting || false,
      
      // Status
      isActive: calendar.isActive !== false,  // Default true
      
      // Internal tracking
      icon: getCalendarIcon(calendar.name),  // We'll assign icons based on name
      lastSynced: new Date()
    }));

    // Check if calendars have changed
    const existingCalendars = location.calendars || [];
    const hasChanged = JSON.stringify(existingCalendars) !== JSON.stringify(transformedCalendars);

    let result;
    if (hasChanged) {
      // Update calendars in database
      result = await db.collection('locations').updateOne(
        { _id: location._id },
        {
          $set: {
            calendars: transformedCalendars,
            calendarsUpdatedAt: new Date(),
            lastCalendarSync: new Date()
          }
        }
      );
      console.log(`[Sync Calendars] Updated ${transformedCalendars.length} calendars`);
    } else {
      // Just update sync timestamp
      result = await db.collection('locations').updateOne(
        { _id: location._id },
        {
          $set: {
            lastCalendarSync: new Date()
          }
        }
      );
      console.log(`[Sync Calendars] No changes detected`);
    }

    const duration = Date.now() - startTime;
    console.log(`[Sync Calendars] Completed in ${duration}ms`);

    // Return summary
    const calendarSummary = transformedCalendars.map((c: any) => ({
      name: c.name,
      type: c.eventType,
      duration: `${c.slotDuration} ${c.slotDurationUnit}`,
      active: c.isActive
    }));

    return {
      updated: hasChanged,
      calendarCount: transformedCalendars.length,
      calendars: calendarSummary,
      activeCount: transformedCalendars.filter((c: any) => c.isActive).length,
      duration: `${duration}ms`
    };

  } catch (error: any) {
    console.error(`[Sync Calendars] Error:`, error.response?.data || error.message);
    
    // Handle specific error cases
    if (error.response?.status === 404) {
      console.log(`[Sync Calendars] No calendars found for location`);
      return {
        updated: false,
        calendarCount: 0,
        calendars: [],
        activeCount: 0,
        error: 'No calendars found'
      };
    }
    
    if (error.response?.status === 401) {
      throw new Error('Authentication failed - invalid token or API key');
    }
    
    if (error.response?.status === 403) {
      throw new Error('Access denied - check permissions for calendars');
    }
    
    throw error;
  }
}

// Helper function to assign icons based on calendar name
function getCalendarIcon(name: string): string {
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes('consultation') || nameLower.includes('consult')) {
    return 'people-outline';
  }
  if (nameLower.includes('service') || nameLower.includes('repair')) {
    return 'construct-outline';
  }
  if (nameLower.includes('inspection') || nameLower.includes('estimate')) {
    return 'clipboard-outline';
  }
  if (nameLower.includes('follow') || nameLower.includes('call')) {
    return 'call-outline';
  }
  if (nameLower.includes('meet') || nameLower.includes('zoom')) {
    return 'videocam-outline';
  }
  
  // Default icon
  return 'calendar-outline';
}