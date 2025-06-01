// pages/api/webhooks/trigger-cron.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../cron/process-webhooks';

export default async function triggerHandler(req: NextApiRequest, res: NextApiResponse) {
  // Add the authorization header that the cron job expects
  req.headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
  
  // Call the cron handler
  return handler(req, res);
}