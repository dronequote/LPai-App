// pages/api/users/set-password.ts
import bcrypt from 'bcryptjs'; // Changed from 'bcrypt' to 'bcryptjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, newPassword, adminToken } = req.body;

  // Verify admin token or implement your own auth check
  if (adminToken !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await db.collection('users').updateOne(
      { email },
      { 
        $set: { 
          hashedPassword,
          needsPasswordReset: false,
          requiresReauth: false,
          updatedAt: new Date()
        },
        $unset: {
          reauthReason: ""
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}