import { ObjectId } from 'mongodb';

const contacts = [
  {
  "_id": new ObjectId(\"7ebc44f2bb6e486584c916b206f20ad1\"),
  "firstName": "\"Michelle\"",
  "lastName": "\"Hicks\"",
  "email": "\"hendrixjeff@yahoo.com\"",
  "phone": "\"952.259.4881\"",
  "ghlContactId": "\"7ebc44f2-bb6e-4865-84c9-16b206f20ad1\"",
  "locationId": "\"gs59LyvPJDe0sNgkZcS0\"",
  "createdAt": "\"2024-11-28T08:31:05\"",
  "notes": "\"\"",
  "address": "\"7103 Mercedes Park, Roberttown, MO 01775\""
}
];
const projects = [
  {
  "_id": new ObjectId(\"61d8c8972b7619133adc2bb5\"),
  "contactId": new ObjectId(\"7ebc44f2bb6e486584c916b206f20ad1\"),
  "userId": new ObjectId(\"b3daa77b4c04a9551b8781d0\"),
  "quoteId": new ObjectId(\"71c4f7f29a701b9832f7093a\"),
  "title": "\"Whole House Repipe\"",
  "status": "\"Scheduled\"",
  "locationId": "\"gs59LyvPJDe0sNgkZcS0\"",
  "ghlOpportunityId": "\"ed521103-41a2-427f-9192-7a565341bdf7\"",
  "createdAt": "\"2025-02-18T00:32:23.808000\"",
  "scopeOfWork": "\"Replace all water lines throughout home with PEX piping.\"",
  "products": [],
  "totalCost": 3446.67,
  "notes": "\"\""
}
];
const quotes = [
  {
  "_id": new ObjectId(\"71c4f7f29a701b9832f7093a\"),
  "contactId": new ObjectId(\"7ebc44f2bb6e486584c916b206f20ad1\"),
  "projectId": new ObjectId(\"61d8c8972b7619133adc2bb5\"),
  "userId": new ObjectId(\"b3daa77b4c04a9551b8781d0\"),
  "locationId": "\"gs59LyvPJDe0sNgkZcS0\"",
  "items": [],
  "total": 3446.67,
  "signed": false,
  "sentAt": "\"2025-02-17T15:39:57.655+00:00\"",
  "createdAt": "\"2025-02-17T16:35:58.664+00:00\""
}
];
const appointments = [
  {
  "_id": new ObjectId(\"b040968483f4a5524ca403d3\"),
  "contactId": new ObjectId(\"7ebc44f2bb6e486584c916b206f20ad1\"),
  "userId": new ObjectId(\"b3daa77b4c04a9551b8781d0\"),
  "locationId": "\"gs59LyvPJDe0sNgkZcS0\"",
  "type": "\"Consultation\"",
  "time": "\"2025-01-30T16:48:40\"",
  "ghlAppointmentId": "\"815188f8-1b46-4762-a0f4-1420aae54f50\"",
  "createdAt": "\"2025-01-18T16:48:40\""
}
];

import clientPromise from '../src/lib/mongodb';

async function seed() {
  const client = await clientPromise;
  const db = client.db('lpai');

  await db.collection('contacts').deleteMany({});
  await db.collection('contacts').insertMany(contacts);

  await db.collection('projects').deleteMany({});
  await db.collection('projects').insertMany(projects);

  await db.collection('quotes').deleteMany({});
  await db.collection('quotes').insertMany(quotes);

  await db.collection('appointments').deleteMany({});
  await db.collection('appointments').insertMany(appointments);

  console.log('✅ Seeded all collections successfully.');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
