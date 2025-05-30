DepartureWidget Enhancement Plan
1. Layout Improvements

Full Width Design: Remove margins, extend to screen edges
Better Spacing: More breathing room for all elements
Visual Hierarchy: Make countdown more prominent

2. Navigation Features
2.1 GPS Integration

User Settings: Add GPS preference (Apple Maps, Google Maps, Waze)
Navigate Action:

Show prompt: "Would you like to notify customer you're on your way?"
If yes → Send SMS with tracking link
Open selected GPS app



2.2 Real-Time ETA

Current Location: Use device GPS to get current position
Route Calculation:

Google Maps API for real-time travel time
Account for traffic conditions
Update every 30 seconds



2.3 Departure Time Calculation

Formula: Appointment Time - Travel Time - Buffer Time
Buffer Time: User preference (default 5 min early)
Display: "Best time to leave" instead of just countdown

3. SMS/Communication Features
3.1 GHL SMS Integration

API Endpoint: PUT to GHL conversations API
Message Templates:

"On my way" with tracking link
"Running late" with new ETA
Custom messages



3.2 Location Sharing

Live Tracking: Generate temporary tracking link
Options:

Share via GHL SMS (API)
Share via device SMS/email (native)
Duration: Auto-expire after appointment



3.3 Communication Preferences

User Settings:

SMS Method: GHL API or Native Device
Email Method: GHL API or Native Device
Default messages customization



4. User Settings Screen Updates
typescriptinterface UserPreferences {
  navigation: {
    preferredGPS: 'apple' | 'google' | 'waze';
    arrivalBuffer: number; // minutes early (default 5)
  };
  communication: {
    smsMethod: 'ghl' | 'native';
    emailMethod: 'ghl' | 'native';
    autoNotifyOnDepart: boolean;
    shareLocationByDefault: boolean;
  };
  messages: {
    onMyWay: string;
    runningLate: string;
    arrived: string;
  };
}
5. API Requirements
5.1 GHL SMS API
typescript// Send SMS with tracking
POST /api/ghl/send-sms
{
  contactId: string;
  locationId: string;
  message: string;
  trackingLink?: string;
}
5.2 Location Tracking Service
typescript// Create tracking session
POST /api/tracking/create
{
  appointmentId: string;
  technicianId: string;
  duration: number; // minutes
}
// Returns: { trackingId, shareUrl }

// Update location
PUT /api/tracking/:trackingId/location
{
  lat: number;
  lng: number;
  timestamp: string;
}
5.3 ETA Calculation
typescript// Get real-time ETA
POST /api/maps/calculate-eta
{
  origin: { lat, lng };
  destination: { lat, lng };
  mode: 'driving';
}
// Returns: { duration, distance, route }
6. Implementation Steps

Update DepartureWidget UI - Full width, better layout
Add GPS preference to user settings
Implement real-time location & ETA calculation
Create GHL SMS integration
Build location tracking service
Add communication preferences
Create message templates system
Test end-to-end flow

7. Widget Information Display

Primary: Countdown to departure
Secondary:

Customer name
Appointment type
Appointment time (e.g., "2:30 PM appointment")
Address
Real-time travel duration
Traffic conditions indicator



8. Action Buttons

Navigate: Primary blue button with GPS icon
I'm Running Late: Secondary outline button
More Options: Three dots for additional actions

Call customer
View appointment details
Cancel/Reschedule