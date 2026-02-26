import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// app/api/power-data/stream/route.ts (SSE)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idMesin = searchParams.get('idMesin') || 'MESIN_01';

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      let lastData: any = null;
      
      const sendData = async () => {
        try {
          // Ambil data terbaru
          const latestData = await prisma.powerData.findFirst({
            where: { idMesin },
            orderBy: { timestamp: 'desc' },
          });

          // Format data untuk chart
          const formattedData = latestData ? {
            ...latestData,
            voltageA: latestData.voltageAvg,
            voltageB: latestData.voltageAvg,
            voltageC: latestData.voltageAvg,
            voltageAvg: latestData.voltageAvg,
            currentA: latestData.currentAvg,
            currentB: latestData.currentAvg,
            currentC: latestData.currentAvg,
            currentAvg: latestData.currentAvg,
            powerActive: latestData.powerTotal ? latestData.powerTotal / 1000 : 0,
            frequency: latestData.frequency,
            energyKwh: latestData.energyKwh,
          } : {
            idMesin,
            timestamp: new Date().toISOString(),
            voltageA: 0,
            voltageB: 0,
            voltageC: 0,
            voltageAvg: 0,
            currentA: 0,
            currentB: 0,
            currentC: 0,
            currentAvg: 0,
            powerActive: 0,
            frequency: 0,
            energyKwh: 0,
          };

          // Hanya kirim jika data berubah (update setiap 30 detik)
          if (JSON.stringify(formattedData) !== JSON.stringify(lastData)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(formattedData)}\n\n`));
            lastData = formattedData;
          }
        } catch (error) {
          console.error('Error sending power data:', error);
        }
      };

      // Send data every 5 seconds (lebih lambat karena data hanya update setiap 30 detik)
      const interval = setInterval(sendData, 5000);
      await sendData();

      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}