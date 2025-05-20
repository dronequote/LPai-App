import clientPromise from '../src/lib/mongodb';

const locationId = 'gs59LyvPJDe0sNgkZcS0';

const library = {
  locationId,
  categories: [
    {
      name: 'Fixtures',
      items: [
        { name: 'Toilet', price: 250 },
        { name: 'Vanity Sink', price: 180 },
        { name: 'Faucet', price: 120 }
      ]
    },
    {
      name: 'Piping',
      items: [
        { name: 'PVC Pipe (10ft)', price: 40 },
        { name: 'Copper Pipe (10ft)', price: 85 },
        { name: 'PEX Tubing Roll', price: 110 }
      ]
    },
    {
      name: 'Labor',
      items: [
        { name: 'Install Faucet', price: 90 },
        { name: 'Repipe Room', price: 600 },
        { name: 'Sewer Line Inspection', price: 350 }
      ]
    }
  ],
  createdAt: new Date()
};

async function run() {
  const client = await clientPromise;
  const db = client.db('lpai');

  await db.collection('libraries').deleteMany({ locationId });
  await db.collection('libraries').insertOne(library);

  console.log(`✅ Seeded part library for location: ${locationId}`);
  process.exit(0);
}

run();
