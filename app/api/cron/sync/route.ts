import { syncAll } from "@/lib/syncService";
import { NextResponse } from "next/server";

export async function GET (request: Request) {
    try{
        const authHeader = request.headers.get('Authorization');
        const CRON_SECRRET = process.env.CRON_SECRET;

        if (!CRON_SECRRET || authHeader !== `Bearer ${CRON_SECRRET}`) {
            return new Response('Unauthorized', { status: 401 });
        }

        //jalankan  sync
        await syncAll();
        return NextResponse.json({
            success: true,
            message: 'Sync completed successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error during sync:', error);
        return NextResponse.json({error: 'Sync failed'}, { status: 500 });
    }
}