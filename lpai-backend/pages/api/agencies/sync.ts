// pages/api/agencies/sync.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../src/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Get all company-level OAuth records
    const companyRecords = await db.collection('locations')
      .find({ 
        isCompanyLevel: true,
        'ghlOAuth.accessToken': { $exists: true }
      })
      .toArray();

    const results = [];

    for (const company of companyRecords) {
      try {
        // Trigger location sync for each company
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/oauth/get-location-tokens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: company.companyId })
        });

        const data = await response.json();
        results.push({
          companyId: company.companyId,
          name: company.name,
          success: response.ok,
          locationsFound: data.totalLocations || 0
        });
      } catch (error) {
        results.push({
          companyId: company.companyId,
          name: company.name,
          success: false,
          error: error.message
        });
      }
    }

    return res.status(200).json({
      success: true,
      companiesProcessed: results.length,
      results
    });

  } catch (error: any) {
    console.error('[Agency Sync] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}