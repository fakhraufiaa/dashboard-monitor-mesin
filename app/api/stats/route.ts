import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [
      totalLogs,
      activeSessions,
      deniedAccess,
      powerLoss,
      totalUsers,
      activeUsers
    ] = await Promise.all([
      prisma.rFIDLog.count(),
      prisma.rFIDLog.count({ where: { statusSesi: 'ON' } }),
      prisma.rFIDLog.count({ where: { statusSesi: 'DITOLAK' } }),
      prisma.rFIDLog.count({ where: { statusSesi: 'OFF (Power Loss)' } }),
      prisma.userList.count(),
      prisma.userList.count({ where: { status: 'AKTIF' } }),
    ]);

    return NextResponse.json({
      totalLogs,
      activeSessions,
      deniedAccess,
      powerLoss,
      totalUsers,
      activeUsers
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    // Kembalikan default values jika error
    return NextResponse.json({
      totalLogs: 0,
      activeSessions: 0,
      deniedAccess: 0,
      powerLoss: 0,
      totalUsers: 0,
      activeUsers: 0
    });
  }
}