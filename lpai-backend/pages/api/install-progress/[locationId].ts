// pages/api/install-progress/[locationId].ts
export default async function handler(req, res) {
  const { locationId } = req.query;
  const location = await db.collection('locations').findOne({ locationId });
  
  return res.json({
    status: location.setupCompleted ? 'complete' : 'in_progress',
    steps: location.setupResults?.steps || {},
    duration: location.setupResults?.duration
  });
}