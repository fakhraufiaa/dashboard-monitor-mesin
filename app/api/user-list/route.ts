import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// app/api/user-list/route.ts
export async function GET() {
  try {
    const users = await prisma.userList.findMany({
      orderBy: { nama: 'asc' }
    });
    // Selalu kembalikan array, meskipun kosong
    return NextResponse.json(users || []);
  } catch (error) {
    console.error('Error fetching users:', error);
    // Kembalikan array kosong jika error
    return NextResponse.json([]);
  }
}