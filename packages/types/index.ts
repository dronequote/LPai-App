export interface Project {
  _id: string;
  title: string;
  status: string;
  createdAt: string;
  contactId: string;
  userId?: string;
  locationId: string;
  notes?: string;
  quoteId?: string;
  [key: string]: any; // for UI metadata like contactName

  // 🔽 Optional, UI-only display field (not from DB)
  contactName?: string;
}

export interface Contact {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  notes?: string;
  status: string;
  locationId: string;
  ghlContactId: string;
  projects?: Project[];
}

export interface User {
  userId: string;
  name: string;
  email: string;
  role: string;
  locationId: string;
  permissions: string[];
}
export interface Calendar {
  id: string;
  calendarId?: string;
  name: string;
  color?: string;
  icon?: string;
  // ...other fields
}

export interface Appointment {
  _id: string;
  title: string;
  contactId: string;
  calendarId: string;
  start: string;
  end: string;
  notes?: string;
  status?: string;
  
  // ...other fields
}