import clientPromise from "@/lib/mongodb";

export const getLocation = async (locationId: string): Promise<any> => {
    const client = await clientPromise;
    const db = client.db('lpai');

    return db.collection('locations').findOne({ locationId });
  };