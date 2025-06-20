// pages/api/users/push-token.ts
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, pushToken, platform } = req.body;

  try {
    const client = await clientPromise;
    const db = client.db('lpai');

    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          pushToken,
          pushPlatform: platform,
          pushTokenUpdatedAt: new Date(),
        }
      }
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}