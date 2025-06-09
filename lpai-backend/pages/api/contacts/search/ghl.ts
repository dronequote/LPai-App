import axios from 'axios';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  sendSuccess,
  sendBadRequest,
  sendUnauthorized,
  sendServerError,
} from '../../../../src/utils/httpResponses';
import { GHL_ENDPOINTS } from '../../../../constants/ghl';
import { getAuthHeader } from '@/utils/ghlAuth';
import { getLocation } from '../../../../src/utils/getLocation';
import cors from '@/lib/cors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    await cors(req, res);
  if (req.method !== 'POST') {
    return sendBadRequest(res, 'Method not allowed', 'Invalid Method');
  }

  const payload = req.body;
  const locationId = payload.locationId;

  if (!payload || !locationId) {
    return sendBadRequest(res, 'Missing required field: locationId');
  }

  const location = await getLocation(locationId);
  
  const auth = await getAuthHeader(location);
  
  const options = {
    method: 'POST',
    url: GHL_ENDPOINTS.CONTACTS.search,
    headers: {
      Authorization: auth.header,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    data: payload,
  };

  try {
    const { data } = await axios.request(options);
    return sendSuccess(res, data, 'Contacts retrieved successfully');
  } catch (error: any) {
    if (error?.response?.status === 401) {
      return sendUnauthorized(res, error.message, 'Invalid or expired token');
    }

    return sendServerError(res, error, 'Failed to retrieve contacts');
  }
}
