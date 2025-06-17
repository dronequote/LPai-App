// pages/api/invoices/create.ts

import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { invoiceSchema } from '../../../../schemas/invoice.schema'
import { GHL_ENDPOINTS } from '../../../../constants/ghl';
import cors from '@/lib/cors';
import { getAuthHeader } from '@/utils/ghlAuth';
import { getLocation } from '../../../../src/utils/getLocation';
import {
  sendSuccess,
  sendBadRequest,
  sendUnauthorized,
  sendServerError,
} from '../../../../src/utils/httpResponses';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await cors(req, res);

  if (req.method !== 'POST') {
    return sendBadRequest(res, 'Method Not Allowed');
  }

  try {
    const validated = await invoiceSchema.validate(req.body, { abortEarly: false });
    const locationId = validated.altId;

    const location = await getLocation(locationId);
    if (!location) {
      return sendUnauthorized(res, 'Invalid location or missing credentials');
    }

    const auth = await getAuthHeader(location);

    const ghlRes = await axios.post(GHL_ENDPOINTS.INVOICES.base, validated, {
      headers: {
        Authorization: auth.header,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    return sendSuccess(res, ghlRes.data, 'Invoice created successfully');
  } catch (error: any) {
    console.error('❌ Invoice creation error:', error);

    if (error.name === 'ValidationError') {
      return sendBadRequest(res, 'Validation failed', error.errors);
    }

    const status = error.response?.status || 500;
    const message = error.response?.data?.message || 'Unexpected error occurred';
    const data = error.response?.data || null;

    return sendServerError(res, message, data);
  }
}