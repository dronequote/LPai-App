// /pages/api/cron/daily-report.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { DailyReportGenerator } from '../../../src/utils/reports/dailyReport';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  
  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    
    const reportGenerator = new DailyReportGenerator(db);
    await reportGenerator.generateDailyReport();
    
    return res.status(200).json({
      success: true,
      message: 'Daily report generated and sent',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Daily Report Cron] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate daily report',
      message: error.message
    });
  }
}

export const config = {
  maxDuration: 60
};