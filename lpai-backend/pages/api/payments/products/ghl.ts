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
  if (req.method !== 'GET') {
    return sendBadRequest(res, 'Method not allowed', 'Invalid Method');
  }

  const locationId = typeof req.query.locationId === 'string' ? req.query.locationId : null;

  if (!locationId) {
    return sendBadRequest(res, 'Missing required field: locationId');
  }

  const location = await getLocation(locationId);
  
  const auth = await getAuthHeader(location);
  
  const options = {
    method: 'GET',
    url: `${GHL_ENDPOINTS.PRODUCTS.base}/?locationId=${locationId}`,
    headers: {
      Authorization: auth.header,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };

  try {
    const { data } = await axios.request(options);
    return sendSuccess(res, data, 'Products retrieved successfully');
  } catch (error: any) {
    if (error?.response?.status === 401) {
      return sendUnauthorized(res, error.message, 'Invalid or expired token');
    }

    return sendServerError(res, error, 'Failed to retrieve products');
  }
}
