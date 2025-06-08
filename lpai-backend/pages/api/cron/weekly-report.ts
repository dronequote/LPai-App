// pages/api/cron/weekly-report.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { WeeklyReportGenerator } from '../../../src/utils/reports/weeklyReport';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  
  const hasValidAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;
  
  if (!isVercelCron && !hasValidAuth) {
    console.log('[Weekly Report Cron] Unauthorized attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    
    console.log('[Weekly Report Cron] Starting weekly report generation...');
    
    const reportGenerator = new WeeklyReportGenerator(db);
    await reportGenerator.generateWeeklyReport();
    
    console.log('[Weekly Report Cron] Weekly report sent successfully');
    
    return res.status(200).json({
      success: true,
      message: 'Weekly report sent successfully',
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Weekly Report Cron] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate weekly report',
      message: error.message
    });
  }
}