import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idMesin = searchParams.get('idMesin') || 'MESIN_01';
  const limit = parseInt(searchParams.get('limit') || '60');

  try {
    const powerData = await prisma.powerData.findMany({
      where: { idMesin },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    // Format data untuk chart
    const formattedData = powerData.reverse().map(data => ({
      ...data,
      // Untuk kompatibilitas dengan chart yang sudah ada
      voltageA: data.voltageAvg, // Gunakan voltageAvg sebagai representasi
      voltageB: data.voltageAvg,
      voltageC: data.voltageAvg,
      voltageAvg: data.voltageAvg,
      currentA: data.currentAvg,
      currentB: data.currentAvg,
      currentC: data.currentAvg,
      currentAvg: data.currentAvg,
      powerActive: data.powerTotal ? data.powerTotal / 1000 : 0, // Convert Watt ke kW
      powerReactive: 0, // Tidak ada data
      frequency: data.frequency,
      energyKwh: data.energyKwh,
    }));

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error fetching power data:', error);
    return NextResponse.json([]);
  }
}