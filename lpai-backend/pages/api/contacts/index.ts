import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import clientPromise from '../../../src/lib/mongodb';
import {
    sendSuccess,
    sendBadRequest,
    sendUnauthorized,
    sendServerError,
  } from '../../../utils/httpResponses';
import { GHL_ENDPOINTS } from '../../../constants/ghl';
import { getAuthHeader } from '@/utils/ghlAuth';
import { getLocation } from '../../../utils/getLocation';

function formatPhoneToE164(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (phone.startsWith('+')) return phone;

  return `+1${cleaned}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'POST':
      return handleCreateContact(req, res);
    default:
      return sendBadRequest(res, 'Method not allowed', 'Invalid Method');
  }
}

async function handleCreateContact(req: NextApiRequest, res: NextApiResponse) {
  try {
    const body = req.body;
    const locationId = typeof req.query.locationId === 'string' ? req.query.locationId : null;

    if (!locationId) {
      return sendBadRequest(res, 'Missing locationId in query parameters');
    }

    if (!body || !body.email) {
      return sendBadRequest(res, 'Missing contact email or payload');
    }

    if (body.phone) {
      body.phone = formatPhoneToE164(body.phone);
    }

    const location = await getLocation(locationId);

    const auth = await getAuthHeader(location);

    const ghlResponse = await axios.post(
      GHL_ENDPOINTS.CONTACTS.base,
      {
        ...body,
        locationId,
      },
      {
        headers: {
          Authorization: auth.header,
          'Content-Type': 'application/json',
          Version: '2021-07-28',
        },
      }
    );

    return sendSuccess(res, ghlResponse.data, 'Contact created successfully in GHL');
  } catch (error: any) {
    console.error('❌ Error creating contact in GHL:', error.response?.data || error.message);

    if (error?.response?.status === 401) {
      return sendUnauthorized(res, error.message, 'Invalid or expired GHL token');
    }

    return sendServerError(res, error, 'Failed to create contact in GHL');
  }
}
