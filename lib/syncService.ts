// lib/syncService.ts
import { prisma } from "./prisma";
import { getLatestLogs, getUserList, getPowerData } from './googleSheets';
import { log } from "util";
import { timeStamp } from "console";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!;
// Test fungsi parser pada timestamp
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
    console.warn('⚠️ Timestamp kosong');
    return new Date();
  }
  
  try {
    // Handle berbagai format yang mungkin masuk
    let cleanTimestamp = timestampStr.trim();
    
    // Format: "25/02/2026 9:21:19"
    if (cleanTimestamp.includes('/')) {
      const [datePart, timePart] = cleanTimestamp.split(' ');
      const [day, month, year] = datePart.split('/').map(Number);
      const [hours, minutes, seconds] = timePart.split(':').map(Number);
      
      // Validasi
      if (day && month && year && !isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
        const date = new Date(year, month - 1, day, hours, minutes, seconds);
        
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    // Format: "2026-02-26T9:02:57" (ISO-like)
    if (cleanTimestamp.includes('T')) {
      const date = new Date(cleanTimestamp);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // Fallback
    console.warn(`⚠️ Could not parse timestamp: "${timestampStr}", using current time`);
    return new Date();
    
  } catch (error) {
    console.warn(`❌ Error parsing timestamp "${timestampStr}":`, error);
    return new Date();
  }
}

// lib/syncService.ts

function parsePowerTimestamp(timestampStr: string): Date {
  if (!timestampStr) {
    console.warn('⚠️ Timestamp kosong');
    return new Date();
  }
  
  try {
    // Format: "2026-02-26T9:59:59"
    console.log('Parsing power timestamp:', timestampStr);
    
    // Hapus karakter 'T' dan split
    const cleanStr = timestampStr.replace('T', ' ');
    
    // Split jadi tanggal dan waktu
    const [datePart, timePart] = cleanStr.split(' ');
    
    // Parse tanggal: "2026-02-26"
    const [year, month, day] = datePart.split('-').map(Number);
    
    // Parse waktu: "9:59:59" → pastikan jam 2 digit
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    
    // Validasi
    if (!year || !month || !day || isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      throw new Error('Invalid date components');
    }
    
    // Buat date object
    const date = new Date(year, month - 1, day, hours, minutes, seconds);
    
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date after construction');
    }
    
    console.log('✅ Parsed:', date.toISOString());
    return date;
    
  } catch (error) {
    console.warn(`❌ Error parsing timestamp "${timestampStr}":`, error);
    return new Date(); // Fallback
  }
}

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

// lib/syncService.ts - fungsi syncPowerData

export async function syncPowerData() {
  try {
    // Dapatkan timestamp terakhir dari database
    const lastPowerData = await prisma.powerData.findFirst({
      orderBy: { timestamp: 'desc' }
    });
    
    const lastTimestamp = lastPowerData?.timestamp?.getTime() || 0;
    console.log('🕒 Last power data timestamp:', lastPowerData?.timestamp || 'No data');

    // Ambil data dari Google Sheets
    const powerData = await getPowerData(SPREADSHEET_ID, 500);
    console.log(`📋 Total power data from sheet: ${powerData.length}`);

    // Parse timestamp PAKAI FUNGSI KHUSUS POWER DATA
    const dataWithParsedDate = powerData.map(data => ({
      ...data,
      parsedTimestamp: parsePowerTimestamp(data.timestamp) // ← PAKAI INI
    }));

    // Filter berdasarkan timestamp
    const newData = dataWithParsedDate.filter(data => 
      data.parsedTimestamp.getTime() > lastTimestamp
    );
    
    console.log(`✨ New power data to sync: ${newData.length}`);

    let syncedCount = 0;
    
    for (const data of newData) {
      try {
        // Cek duplikasi dengan toleransi 2 detik
        const existingData = await prisma.powerData.findFirst({
          where: {
            AND: [
              {
                timestamp: {
                  gte: new Date(data.parsedTimestamp.getTime() - 2000),
                  lte: new Date(data.parsedTimestamp.getTime() + 2000)
                }
              },
              { idMesin: data.idMesin }
            ]
          }
        });

        if (existingData) {
          console.log(`⏭️ Power data already exists: ${data.idMesin} at ${data.timestamp}`);
          continue;
        }

        // Buat data baru
        await prisma.powerData.create({
          data: {
            timestamp: data.parsedTimestamp,
            idMesin: data.idMesin,
            voltageAvg: data.voltageAvg,
            currentAvg: data.currentAvg,
            powerTotal: data.powerTotal,
            frequency: data.frequency,
            energyKwh: data.energyKwh,
            status: data.status || 'Success',
          },
        });

        syncedCount++;
        console.log(`✅ Synced power data: ${data.idMesin} at ${data.timestamp}`);
        
      } catch (e) {
        console.error('❌ Error processing power data:', { 
          idMesin: data.idMesin, 
          timestamp: data.timestamp 
        }, e);
      }
    }
    
    console.log(`✅ Synced ${syncedCount} new power data points`);
    
  } catch (error) {
    console.error('❌ Error syncing power data:', error);
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



// export async function syncRFIDLogs() {
//   try {
//      // Cari timestamp terakhir di database
//     const lastLog = await prisma.rFIDLog.findFirst({
//       orderBy: { timestamp: 'desc' }
//     });

//     // Gunakan getTime() untuk perbandingan yang akurat
//     const lastTimestamp = lastLog?.timestamp ? lastLog.timestamp.getTime() : 0;
//     console.log('🕒 Last synced timestamp:', lastLog?.timestamp || 'No data');

//     // ambil semua logs dari Google Sheets
//     const logs = await getLatestLogs(SPREADSHEET_ID, 1000);
//     console.log(`📋 Total logs from sheet: ${logs.length}`);

//      // Parse timestamp dan filter yang lebih baru
//     const logsWithParsedDate = logs.map(log => ({
//       ...log,
//       parsedTimestamp: parseExcelTimestamp(log.timestamp)
//     }));

//     const newLogs = logsWithParsedDate.filter(log => log.parsedTimestamp.getTime() > lastTimestamp);
  
//     console.log(`✨ New logs to sync: ${newLogs.length}`);
    
//     let syncedCount = 0;
 
//     for (const log of newLogs) {
//       // Parse timestamp dengan fungsi baru
//       const existing = await prisma.rFIDLog.findFirst({
//         where: {
//           AND: [
//             { timestamp: {
//               gte: new Date(log.parsedTimestamp.getTime() - 1000), // 1 detik sebelum
//               lte: new Date(log.parsedTimestamp.getTime() + 1000)  // 1 detik setelah
//             }},
//             { uid: log.uid }
//           ]
//         }
//       });

//       if (existing) {
//           console.log(`⏭️ Log already exists: ${log.uid} at ${log.timestamp}`);
//           continue;
//       }

//       //CARI USER
//       const user = await prisma.userList.findUnique({
//          where: { uid: log.uid }
//       });

//       // Buat RFID log
//       await prisma.rFIDLog.create({
//         data: {
//           no: log.no,
//           timestamp: log.parsedTimestamp,
//           idMesin: log.idMesin,
//           waktuOn: log.waktuOn,
//           waktuOff: log.waktuOff,
//           uid: log.uid,
//           namaUser: user ? (log.namaUser || user.nama) : "Unknown/Kartu asing",
//           statusSesi: user ? log.statusSesi : "DITOLAK",
//           durasi: log.durasi,
//           ...(user && {
//             UserList: {
//               connect: { id: user.id }
//             }
//             })
//           },
//         });

//         syncedCount++;
//         console.log(`✅ Synced: ${log.uid} at ${log.timestamp}`);

//       // const timestamp = parseExcelTimestamp(log.timestamp);
      
//       // console.log(`Log: UID=${log.uid}, Time=${log.timestamp} → ${timestamp.toISOString()}`);
      
//       // // Cari user
//       // const user = await prisma.userList.findUnique({
//       //   where: { uid: log.uid }
//       // });

//       // // Buat RFID log
//       // await prisma.rFIDLog.create({
//       //   data: {
//       //     no: log.no,
//       //     timestamp: timestamp, // ← Sekarang pakai timestamp yang sudah benar
//       //     idMesin: log.idMesin,
//       //     waktuOn: log.waktuOn,
//       //     waktuOff: log.waktuOff,
//       //     uid: log.uid,
//       //     namaUser: user ? (log.namaUser || user.nama) : "Unknown/Kartu asing",
//       //     statusSesi: user ? log.statusSesi : "DITOLAK",
//       //     durasi: log.durasi,
//       //     ...(user && {
//       //       UserList: {
//       //         connect: { id: user.id }
//       //       }
//       //     })
//       //   },
//       // });
//     }    
//     console.log(`✅ Synced ${syncedCount} new RFID logs with correct timestamps`);
//   } catch (error) {
//     console.error('❌ Error syncing RFID logs:', error);
//   }
// }

// lib/syncService.ts

export async function syncRFIDLogs() {
  try {
    // 1. Dapatkan timestamp terakhir dari database (pastikan ini query yang benar)
    const lastLog = await prisma.rFIDLog.findFirst({
      orderBy: { timestamp: 'desc' }
    });
    
    // Gunakan getTime() untuk perbandingan yang akurat
    const lastTimestamp = lastLog?.timestamp ? lastLog.timestamp.getTime() : 0;
    console.log('🕒 Last synced timestamp:', lastLog?.timestamp || 'No data');

    // 2. Ambil logs dari Google Sheets
    const logs = await getLatestLogs(SPREADSHEET_ID, 1000);
    console.log(`📋 Total logs from sheet: ${logs.length}`);

    // 3. Parse timestamp dan filter yang lebih baru
    const logsWithParsedDate = logs.map(log => ({
      ...log,
      parsedTimestamp: parseExcelTimestamp(log.timestamp)
    }));

    // Filter berdasarkan timestamp (dalam milidetik)
    const newLogs = logsWithParsedDate.filter(log => 
      log.parsedTimestamp.getTime() > lastTimestamp
    );
    
    console.log(`✨ New logs to sync: ${newLogs.length}`);

    let syncedCount = 0;
    
    for (const log of newLogs) {
      try {
        // 4. CEK DUPLIKASI berdasarkan timestamp dan uid (dalam milidetik)
        const existing = await prisma.rFIDLog.findFirst({
          where: {
            AND: [
              {
                timestamp: {
                  // Cek dalam rentang 1 detik untuk toleransi perbedaan milidetik
                  gte: new Date(log.parsedTimestamp.getTime() - 1000),
                  lte: new Date(log.parsedTimestamp.getTime() + 1000)
                }
              },
              { uid: log.uid }
            ]
          }
        });

        if (existing) {
          console.log(`⏭️ Log already exists: ${log.uid} at ${log.timestamp}`);
          continue;
        }

        // 5. Cari user
        const user = await prisma.userList.findUnique({
          where: { uid: log.uid }
        });

        // 6. Buat log baru
        await prisma.rFIDLog.create({
          data: {
            no: log.no,
            timestamp: log.parsedTimestamp,
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

        syncedCount++;
        console.log(`✅ Synced: ${log.uid} at ${log.timestamp}`);
        
      } catch (error) {
        console.error(`❌ Error processing log:`, { uid: log.uid, timestamp: log.timestamp }, error);
      }
    }
    
    console.log(`✅ Sync completed: ${syncedCount} new RFID logs added`);
    
  } catch (error) {
    console.error('❌ Error syncing RFID logs:', error);
  }
}

// Sinkronisasi semua data
export async function syncAll() {
  console.log('Starting full sync...');
  await syncUserList();
  await syncRFIDLogs();
  await syncPowerData();
  console.log('Full sync completed');
}