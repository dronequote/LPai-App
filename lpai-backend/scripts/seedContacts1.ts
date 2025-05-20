// scripts/seedContacts.ts
import clientPromise from '../src/lib/mongodb';
import { faker } from '@faker-js/faker';

const locationId = 'gs59LyvPJDe0sNgkZcS0';

const statuses = ['Open', 'Quoted', 'Scheduled', 'Job Complete'];
const plumbingProjects = [
  'Toilet Replacement',
  'Leak Repair',
  'Water Heater Install',
  'Shower Valve Fix',
  'Whole House Repipe',
  'Sewer Line Inspection',
  'Sink Drain Clog',
  'Tankless Water Heater',
  'Gas Line Install',
  'Garbage Disposal Repair'
];

function generateContacts(count = 30) {
  return Array.from({ length: count }).map(() => ({
    name: faker.person.fullName(),
    email: faker.internet.email(),
    phone: faker.phone.number(), // uses default valid format
    project: faker.helpers.arrayElement(plumbingProjects),
    status: faker.helpers.arrayElement(statuses),
    locationId,
    ghlContactId: faker.string.uuid(),
    createdAt: new Date(),
  }));
}

async function run() {
  const client = await clientPromise;
  const db = client.db('lpai');
  const contacts = db.collection('contacts');

  await contacts.deleteMany({ locationId }); // Clear old data for clean seed
  await contacts.insertMany(generateContacts(30));

  console.log('✅ Seeded 30 plumber contacts.');
  process.exit(0);
}

run();
