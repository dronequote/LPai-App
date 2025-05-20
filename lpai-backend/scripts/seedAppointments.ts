import clientPromise from '../src/lib/mongodb';
import { faker } from '@faker-js/faker';

const locationId = 'gs59LyvPJDe0sNgkZcS0';
const userId = '6823cd78b79cf459334ff4f5'; // 🔑 Use your actual user _id (Fake Employee)

const appointmentTypes = ['Consultation', 'Follow-Up', 'Install', 'Repair'];

function generateAppointments(contactId: string): any[] {
  const count = faker.number.int({ min: 0, max: 2 });
  return Array.from({ length: count }).map(() => ({
    contactId,
    userId,
    locationId,
    type: faker.helpers.arrayElement(appointmentTypes),
    time: faker.date.soon({ days: 14 }), // within next 2 weeks
    ghlAppointmentId: faker.string.uuid(),
    createdAt: new Date(),
  }));
}

async function run() {
  const client = await clientPromise;
  const db = client.db('lpai');

  const contacts = await db.collection('contacts').find({ locationId }).toArray();
  const appointments = contacts.flatMap((c) => generateAppointments(c._id.toString()));

  const result = await db.collection('appointments').insertMany(appointments);
  console.log(`✅ Seeded ${result.insertedCount} appointments.`);
  process.exit(0);
}

run();
