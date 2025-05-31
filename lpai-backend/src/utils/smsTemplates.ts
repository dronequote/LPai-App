// Create: lpai-backend/src/utils/smsTemplates.ts
interface TemplateData {
  user?: any;
  location?: any;
  contact?: any;
  appointment?: any;
  project?: any;
  dynamic?: Record<string, string>;
}

export function processTemplate(template: string, data: TemplateData): string {
  let processed = template;
  
  const variables: Record<string, string> = {
    // User variables
    userName: data.user?.name || '',
    userEmail: data.user?.email || '',
    userRole: data.user?.role || '',
    
    // Location variables
    locationName: data.location?.name || '',
    locationId: data.location?.locationId || '',
    
    // Contact variables
    contactFirstName: data.contact?.firstName || '',
    contactLastName: data.contact?.lastName || '',
    contactEmail: data.contact?.email || '',
    contactPhone: data.contact?.phone || '',
    contactAddress: data.contact?.address || '',
    
    // Appointment variables
    appointmentTitle: data.appointment?.title || '',
    appointmentTime: data.appointment ? new Date(data.appointment.start || data.appointment.time).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    }) : '',
    appointmentDate: data.appointment ? new Date(data.appointment.start || data.appointment.time).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }) : '',
    appointmentNotes: data.appointment?.notes || '',
    
    // Project variables
    projectTitle: data.project?.title || '',
    projectStatus: data.project?.status || '',
    quoteNumber: data.project?.quoteNumber || '',
    
    // Dynamic variables (passed in)
    ...(data.dynamic || {})
  };
  
  // Replace all {variable} with actual values
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    processed = processed.replace(regex, value);
  });
  
  // Remove any remaining unmatched variables
  processed = processed.replace(/{[^}]+}/g, '');
  
  return processed.trim();
}