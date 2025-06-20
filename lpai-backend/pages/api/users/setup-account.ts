// pages/api/users/setup-account.ts
import bcrypt from 'bcryptjs'; // Changed from 'bcrypt' to 'bcryptjs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password required' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    // Find user by setup token
    const user = await db.collection('users').findOne({
      setupToken: token,
      setupTokenExpiry: { $gt: new Date() },
      needsSetup: true
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired setup token' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          hashedPassword,
          needsSetup: false,
          onboardingStatus: 'completed',
          setupCompletedAt: new Date(),
          updatedAt: new Date()
        },
        $unset: {
          setupToken: '',
          setupTokenExpiry: ''
        }
      }
    );

    // Generate JWT for auto-login
    const token = generateJWT({
      userId: user._id.toString(),
      email: user.email,
      locationId: user.locationId,
      role: user.role
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        locationId: user.locationId
      }
    });
  } catch (error) {
    console.error('Setup account error:', error);
    return res.status(500).json({ error: 'Failed to set up account' });
  }
}