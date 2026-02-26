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

export async function syncRFIDLogs() {
  try {
    const logs = await getLatestLogs(SPREADSHEET_ID, 1000);
    
    for (const log of logs) {
      // Parse timestamp dengan lebih baik
      let timestamp: Date;
      
      try {
        // Cek apakah log.timestamp ada dan formatnya benar
        if (log.timestamp && log.timestamp.includes('/')) {
          const [date, time] = log.timestamp.split(' ');
          const [day, month, year] = date.split('/');
          
          // Validasi komponen tanggal
          if (day && month && year && time) {
            timestamp = new Date(`${year}-${month}-${day}T${time}`);
          } else {
            console.warn(`Invalid timestamp format: ${log.timestamp}, using current time`);
            timestamp = new Date();
          }
        } else {
          // Fallback ke current time jika format tidak dikenal
          console.warn(`Unknown timestamp format: ${log.timestamp}, using current time`);
          timestamp = new Date();
        }
        
        // Validasi apakah Date valid
        if (isNaN(timestamp.getTime())) {
          console.warn(`Invalid timestamp after parsing: ${log.timestamp}, using current time`);
          timestamp = new Date();
        }
      } catch (e) {
        console.warn(`Error parsing timestamp: ${log.timestamp}, using current time`, e);
        timestamp = new Date();
      }

      // Cari user di UserList berdasarkan UID
      const user = await prisma.userList.findUnique({
        where: { uid: log.uid }
      });

      // Buat RFID log
      await prisma.rFIDLog.create({
        data: {
          no: log.no,
          timestamp: timestamp, // Pakai timestamp yang sudah diparse
          idMesin: log.idMesin,
          waktuOn: log.waktuOn,
          waktuOff: log.waktuOff,
          uid: log.uid,
          namaUser: user ? (log.namaUser || user.nama) : "Unknown/Kartu asing",
          statusSesi: user ? log.statusSesi : "DITOLAK",
          durasi: log.durasi,
          // Hubungkan ke user jika ditemukan
          ...(user && {
            UserList: {
              connect: { id: user.id }
            }
          })
        },
      });
    }
    
    console.log(`Synced ${logs.length} RFID logs`);
  } catch (error) {
    console.error('Error syncing RFID logs:', error);
  }
}

// Sinkronisasi semua data
export async function syncAll() {
  console.log('Starting full sync...');
  await syncUserList();
  await syncRFIDLogs();
  console.log('Full sync completed');
}