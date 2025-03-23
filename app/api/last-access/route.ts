// app/api/last-access/route.ts
import { NextResponse } from "next/server";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;
if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable in .env.local");
}

const cached = (global as any).mongoose || { conn: null, promise: null }; // Changed from let to const
if (!(global as any).mongoose) {
  (global as any).mongoose = cached;
}

async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const opts = { bufferCommands: false };
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => mongoose);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

const RecordSchema = new mongoose.Schema({
  subjectId: { type: String, required: true },
  heartRate: { 
    bpm: { type: Number, required: true }, 
    confidence: Number 
  },
  hrv: { 
    sdnn: { type: Number, required: true }, 
    confidence: Number 
  },
  ppgData: { type: [Number], default: [] },
  timestamp: { type: Date, default: Date.now },
});

const Record = mongoose.models.Record || mongoose.model("Record", RecordSchema);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subjectId");

  if (!subjectId) {
    return NextResponse.json({ error: "Subject ID is required" }, { status: 400 });
  }

  try {
    await dbConnect();
    const records = await Record.find({ subjectId }).sort({ timestamp: -1 });

    if (!records || records.length === 0) {
      return NextResponse.json(
        { error: "No data found for this subject" },
        { status: 404 }
      );
    }

    const validRecords = records.filter(
      (rec) => rec.heartRate?.bpm && rec.hrv?.sdnn
    );
    
    if (validRecords.length === 0) {
      return NextResponse.json(
        { error: "No valid health data found" },
        { status: 404 }
      );
    }

    const avgHeartRate =
      validRecords.reduce((sum, rec) => sum + rec.heartRate.bpm, 0) / validRecords.length;
    const avgHRV =
      validRecords.reduce((sum, rec) => sum + rec.hrv.sdnn, 0) / validRecords.length;
    const lastAccess = records[0].timestamp;

    return NextResponse.json({
      avgHeartRate: avgHeartRate.toFixed(2),
      avgHRV: avgHRV.toFixed(2),
      lastAccess: lastAccess.toISOString(),
    });
  } catch (error: any) {
    console.error("Error fetching records:", error);
    return NextResponse.json(
      { error: "Failed to fetch data", details: error.message },
      { status: 500 }
    );
  }
}