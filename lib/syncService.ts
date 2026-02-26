// lib/syncService.ts
import { prisma } from "./prisma";
import { getLatestLogs, getUserList } from './googleSheets';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!;

// Sinkronisasi UserList dari sheet Whitelist
export async function syncUserList() {
  try {
    const users = await getUserList(SPREADSHEET_ID);
    console.log(`Found ${users.length} users in Whitelist`);
    
    for (const user of users) {
      await prisma.userList.upsert({
        where: { uid: user.uid },
        update: {
          nama: user.nama,
          status: user.status,
        },
        create: {
          uid: user.uid,
          nama: user.nama,
          status: user.status,
        },
      });
    }
    
    // // Optional: Hapus user yang tidak ada di sheet (jika diperlukan)
    // const uidsInSheet = users.map(u => u.uid);
    // await prisma.userList.deleteMany({
    //   where: {
    //     uid: {
    //       notIn: uidsInSheet,
    //     },
    //   },
    // });
    
    console.log(`Synced ${users.length} users from Whitelist`);
  } catch (error) {
    console.error('Error syncing user list:', error);
  }
}

// Sinkronisasi RFID Logs
// export async function syncRFIDLogs() {
//   try {
//     const logs = await getLatestLogs(SPREADSHEET_ID, 1000);
    
//     for (const log of logs) {
//       // Parse timestamp dari format "dd/MM/yyyy HH:mm:ss"
//       const [date, time] = log.timestamp.split(' ');
//       const [day, month, year] = date.split('/');
//       const timestamp = new Date(`${year}-${month}-${day}T${time}`);

//       // Cari user di UserList berdasarkan UID
//       const user = await prisma.userList.findUnique({
//         where: { uid: log.uid }
//       });

//       if (!user) {
//         console.log("UID tidak ditemukan di whitelist:", log.uid);
//       }

//       // Buat atau update RFID log
//       await prisma.rFIDLog.create({
//         data: {
//           no: log.no,
//           timestamp,
//           idMesin: log.idMesin,
//           waktuOn: log.waktuOn,
//           waktuOff: log.waktuOff,
//           uid: log.uid,
//           namaUser: user? log.namaUser || user?.nama : "Unknown/Kartu asing",
//           statusSesi: user? log.statusSesi : "DITOLAK",
//           durasi: log.durasi,
//           // Hubungkan ke user jika ditemukan
//           ...(user && {
//             UserList: {
//               connect: { id: user.id }
//             }
//           })
//         },
//       });
//     }
    
//     console.log(`Synced ${logs.length} RFID logs`);
//   } catch (error) {
//     console.error('Error syncing RFID logs:', error);
//   }
// }

// Test fungsi parser
// const testDates = [
//   "25/02/2026 9:21:19",
//   "25/02/2026 09:21:19", 
//   "25/02/2026 9:50:52"
// ];

// testDates.forEach(date => {
//   const result = parseExcelTimestamp(date);
//   console.log(`${date} → ${result.toISOString()}`);
// });

function parseExcelTimestamp(timestampStr: string): Date {
  if (!timestampStr) {
    console.warn('Timestamp kosong');
    return new Date();
  }
  
  try {
    // Contoh input: "25/02/2026 9:21:19"
    console.log('Parsing timestamp:', timestampStr);
    
    const [datePart, timePart] = timestampStr.split(' ');
    const [day, month, year] = datePart.split('/').map(Number);
    
    // Handle format time yang mungkin "9:21:19" atau "09:21:19"
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    
    // Validasi komponen
    if (!day || !month || !year || isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      throw new Error('Invalid date components');
    }
    
    // Buat date (month -1 karena JS bulan 0-11)
    const date = new Date(year, month - 1, day, hours, minutes, seconds);
    
    // Validasi hasil
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date after construction');
    }
    
    //aktifkan log untuk melihat hasil parsing
    console.log('✅ Parsed:', date.toISOString());
    return date;
    
  } catch (error) {
    console.warn(`❌ Error parsing timestamp "${timestampStr}":`, error);
    return new Date(); // Fallback ke waktu sekarang
  }
}

export async function syncRFIDLogs() {
  try {
    const logs = await getLatestLogs(SPREADSHEET_ID, 1000);
    console.log(`Processing ${logs.length} logs...`);
    
    for (const log of logs) {
      // Parse timestamp dengan fungsi baru
      const timestamp = parseExcelTimestamp(log.timestamp);
      
      console.log(`Log: UID=${log.uid}, Time=${log.timestamp} → ${timestamp.toISOString()}`);
      
      // Cari user
      const user = await prisma.userList.findUnique({
        where: { uid: log.uid }
      });

      // Buat RFID log
      await prisma.rFIDLog.create({
        data: {
          no: log.no,
          timestamp: timestamp, // ← Sekarang pakai timestamp yang sudah benar
          idMesin: log.idMesin,
          waktuOn: log.waktuOn,
          waktuOff: log.waktuOff,
          uid: log.uid,
          namaUser: user ? (log.namaUser || user.nama) : "Unknown/Kartu asing",
          statusSesi: user ? log.statusSesi : "DITOLAK",
          durasi: log.durasi,
          ...(user && {
            UserList: {
              connect: { id: user.id }
            }
          })
        },
      });
    }
    
    console.log(`✅ Synced ${logs.length} RFID logs with correct timestamps`);
  } catch (error) {
    console.error('❌ Error syncing RFID logs:', error);
  }
}


// Sinkronisasi semua data
export async function syncAll() {
  console.log('Starting full sync...');
  await syncUserList();
  await syncRFIDLogs();
  console.log('Full sync completed');
}