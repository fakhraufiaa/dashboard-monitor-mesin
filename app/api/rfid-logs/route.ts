import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100');
  const idMesin = searchParams.get('idMesin');
  const uid = searchParams.get('uid');
  const status = searchParams.get('status');

  try {
    const where: any = {};
    if (idMesin) where.idMesin = idMesin;
    if (uid) where.uid = uid;
    if (status) where.statusSesi = status;
    
    const logs = await prisma.rFIDLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        UserList: true
      }
    });

    return NextResponse.json(logs || []);
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json([]);
  }
}