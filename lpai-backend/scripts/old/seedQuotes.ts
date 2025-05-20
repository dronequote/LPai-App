import clientPromise from '../src/lib/mongodb';
import { faker } from '@faker-js/faker';

const locationId = 'gs59LyvPJDe0sNgkZcS0';
const userId = '6823cd78b79cf459334ff4f5'; // Fake Employee user _id

function generateItems(libraryItems: any[], count = 2) {
  const selected = faker.helpers.arrayElements(libraryItems, count);
  return selected.map((item) => ({
    name: item.name,
    qty: faker.number.int({ min: 1, max: 3 }),
    price: item.price
  }));
}

function calculateTotal(items: any[]) {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

async function run() {
  const client = await clientPromise;
  const db = client.db('lpai');

  const projects = await db.collection('projects').find({ locationId }).toArray();
  const library = await db.collection('libraries').findOne({ locationId });

  if (!library) {
    console.error('❌ No library found.');
    process.exit(1);
  }

  const flatItems = library.categories.flatMap((c) => c.items);
  const quotes = projects
    .filter(() => Math.random() < 0.5) // randomly include quote for ~50% of projects
    .map((p) => {
      const items = generateItems(flatItems);
      const total = calculateTotal(items);

      return {
        contactId: p.contactId,
        projectId: p._id,
        userId,
        locationId,
        items,
        total,
        signed: false,
        sentAt: faker.date.recent(),
        createdAt: new Date(),
      };
    });

  const result = await db.collection('quotes').insertMany(quotes);
  console.log(`✅ Seeded ${result.insertedCount} quotes.`);
  process.exit(0);
}

run();
