import clientPromise from '../src/lib/mongodb';
import { faker } from '@faker-js/faker';
import { ObjectId } from 'mongodb';

const locationId = 'gs59LyvPJDe0sNgkZcS0';
const statuses = ['Open', 'Quoted', 'Scheduled', 'Job Complete'];

const jobTitles = [
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

function generateProjects(contactId: ObjectId): any[] {
  const count = faker.number.int({ min: 1, max: 2 });
  return Array.from({ length: count }).map(() => ({
    contactId,
    title: faker.helpers.arrayElement(jobTitles),
    status: faker.helpers.arrayElement(statuses),
    quoteId: null,
    locationId,
    ghlOpportunityId: faker.string.uuid(),
    createdAt: new Date(),
  }));
}

async function run() {
  const client = await clientPromise;
  const db = client.db('lpai');
  const contacts = await db.collection('contacts').find({ locationId }).toArray();
  const projects = contacts.flatMap((c) => generateProjects(c._id));

  const result = await db.collection('projects').insertMany(projects);
  console.log(`✅ Seeded ${result.insertedCount} projects.`);
  process.exit(0);
}

run();
