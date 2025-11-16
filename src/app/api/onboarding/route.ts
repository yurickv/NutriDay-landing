// app/api/onboarding/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Here you would save to MongoDB
    // Example:
    // const client = await MongoClient.connect(process.env.MONGODB_URI);
    // const db = client.db('your-database');
    // const collection = db.collection('onboarding');
    // await collection.insertOne(data);
    // await client.close();

    console.log('Received onboarding data:', data);

    return NextResponse.json({
      success: true,
      message: 'Data saved successfully',
    });
  } catch (error) {
    console.error('Error saving onboarding data:', error);
    return NextResponse.json(
      { success: false, message: 'Error saving data' },
      { status: 500 }
    );
  }
}
