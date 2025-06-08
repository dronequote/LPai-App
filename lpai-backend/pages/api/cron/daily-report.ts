// pages/api/cron/daily-report.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';
import { EnhancedDailyReportGenerator } from '../../../src/utils/reports/enhancedDailyReport';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  
  const hasValidAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;
  
  if (!isVercelCron && !hasValidAuth) {
    console.log('[Daily Report Cron] Unauthorized attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');
    
    console.log('[Daily Report Cron] Starting daily report generation...');
    
    const reportGenerator = new EnhancedDailyReportGenerator(db);
    await reportGenerator.generateDailyReport();
    
    console.log('[Daily Report Cron] Daily report sent successfully');
    
    return res.status(200).json({
      success: true,
      message: 'Daily report sent successfully',
      timestamp: new Date()
    });
    
  } catch (error: any) {
    console.error('[Daily Report Cron] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate daily report',
      message: error.message
    });
  }
}