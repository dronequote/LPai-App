import { ObjectId } from "mongodb";
import clientPromise from "../src/lib/mongodb";

const run = async () => {
  const client = await clientPromise;
  const db = client.db("lpai");

  const contacts = [
    {
      _id: new ObjectId("64a3e7cb6a4c9c8b9f0c1d11"),
      firstName: "Michelle",
      lastName: "Hicks",
      email: "michelle.hicks@example.com",
      phone: "952-259-4881",
      locationId: "gs59LyvPJDe0sNgkZcS0",
      createdAt: new Date("2024-11-28T08:31:05Z"),
      notes: "",
      address: "7103 Mercedes Park, Roberttown, MO 01775",
      ghlContactId: "4a8fe2798ac04b27b50037ff"
    },
    {
      _id: new ObjectId("64a3e7cb6a4c9c8b9f0c1d12"),
      firstName: "Douglas",
      lastName: "Jones",
      email: "douglas.jones@example.com",
      phone: "855-225-1229",
      locationId: "gs59LyvPJDe0sNgkZcS0",
      createdAt: new Date("2024-10-13T12:01:09Z"),
      notes: "",
      address: "2743 Travis Summit, Lake Cassandra, LA 90012",
      ghlContactId: "ec2f1eec174e4d2bb88aa113"
    }
  ];

  await db.collection("contacts").insertMany(contacts);
  console.log(`✅ Seeded ${contacts.length} contacts.`);
  process.exit(0);
};

run().catch(console.error);
