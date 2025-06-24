// lpai-backend/pages/api/messages/realtime/connections.ts
// Monitor active SSE connections

import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

// Import the getActiveConnections function from the realtime endpoint
// Note: In production, you'd move this to a shared module
const getActiveConnections = async () => {
  // This would import from the realtime.ts file
  // For now, returning mock data structure
  return [];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require admin auth or special token
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Optional: Check if user is admin
    // if (!decoded.isAdmin) {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }

    // Get active connections
    const connections = await getActiveConnections();
    
    // Group by userId and locationId for summary
    const summary = {
      totalConnections: connections.length,
      byUser: {} as Record<string, number>,
      byLocation: {} as Record<string, number>,
      connections: connections.map(conn => ({
        ...conn,
        durationMinutes: Math.floor(conn.duration / 1000 / 60)
      }))
    };

    // Calculate summaries
    connections.forEach(conn => {
      summary.byUser[conn.userId] = (summary.byUser[conn.userId] || 0) + 1;
      summary.byLocation[conn.locationId] = (summary.byLocation[conn.locationId] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      data: summary
    });

  } catch (error: any) {
    return res.status(401).json({ 
      error: 'Invalid token',
      message: error.message 
    });
  }
}