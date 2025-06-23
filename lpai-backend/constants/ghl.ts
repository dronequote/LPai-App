const BASE_URL = 'https://services.leadconnectorhq.com';

export const GHL_ENDPOINTS = {
    CONTACTS: {
      base: `${BASE_URL}/contacts`,
      search: `${BASE_URL}/contacts/search`,
      get: (contactId: string) => `${BASE_URL}/contacts/${contactId}`,
      update: (contactId: string) => `${BASE_URL}/contacts/${contactId}`,
    },
    APPOINTMENTS: {
      base: `${BASE_URL}/appointments`,
      get: (appointmentId: string) => `${BASE_URL}/appointments/${appointmentId}`,
    },
    INVOICES: {
        base: `${BASE_URL}/invoices/`,
        byId: (id: string) => `${BASE_URL}/invoices/${id}`,
    },
    LOCATIONS: {
      search: `${BASE_URL}/locations/search`,
      get: (locationId: string) => `${BASE_URL}/locations/${locationId}`,
    },
    COMPANIES: {
      get: (companyId: string) => `${BASE_URL}/companies/${companyId}`,
    },
    OAUTH: {
      token: `${BASE_URL}/oauth/token`,
      locationToken: `${BASE_URL}/oauth/locationToken`,
    },
    PRODUCTS: {
        base: `${BASE_URL}/products`,
      },
  };