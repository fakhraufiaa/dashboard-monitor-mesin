import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// app/api/user-list/[uid]/route.ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const user = await prisma.userList.findUnique({
      where: { uid },
      include: {
        RFIDLog: {
          orderBy: { timestamp: 'desc' },
          take: 10
        }
      }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}