// scripts/sync-all.ts
import 'dotenv/config'; // Load environment variables
import { syncAll } from '@/lib/syncService';
import cron from 'node-cron';

// Cek apakah environment variables terbaca
console.log('Checking environment variables:');
console.log('GOOGLE_SHEETS_ID:', process.env.GOOGLE_SHEETS_ID ? '✅ Loaded' : '❌ Missing');
console.log('GOOGLE_CLIENT_EMAIL:', process.env.GOOGLE_CLIENT_EMAIL ? '✅ Loaded' : '❌ Missing');
console.log('GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? '✅ Loaded' : '❌ Missing');

if (!process.env.GOOGLE_SHEETS_ID) {
  console.error('❌ ERROR: GOOGLE_SHEETS_ID is not set in .env.local');
  process.exit(1);
}

// Fungsi untuk menjalankan sync
async function runSync() {
  try {
    console.log('\n🔄 Syncing data from Google Sheets...');
    await syncAll();
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

// Jalankan sync setiap 10 detik
console.log('🚀 Sync service started - running every 10 seconds');

// Jalankan sekali saat startup
runSync();

// Schedule dengan cron
cron.schedule('*/10 * * * * *', runSync);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Stopping sync service...');
  process.exit(0);
});