// lib/googleSheets.ts (tambahkan fungsi baru)
import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL as string,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') as string,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

export async function getSheetData(spreadsheetId: string, range: string) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return response.data.values;
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    return null;
  }
}

// Ambil data dari sheet Log (RFID)
export async function getLatestLogs(spreadsheetId: string, limit: number = 100) {
  const data = await getSheetData(spreadsheetId, 'Log!A:I');
  if (!data || data.length < 2) return [];
  
  // Skip header row (asumsi baris pertama adalah header)
  const rows = data.slice(1);
  return rows.slice(-limit).map((row, index) => ({
    no: parseInt(row[0]) || index + 1,
    timestamp: row[1] || '',
    idMesin: row[2],
    waktuOn: row[3],
    waktuOff: row[4],
    uid: row[5],
    namaUser: row[6] || null,
    statusSesi: row[7],
    durasi: row[8],
  })).reverse();
}

// Ambil data dari sheet Whitelist
export async function getUserList(spreadsheetId: string) {
  const data = await getSheetData(spreadsheetId, 'Whitelist!A:C');
  if (!data || data.length < 2) return [];
  
  return data.slice(1).map(row => ({
    uid: row[0]?.toString().toUpperCase().trim() || '',
    nama: row[1]?.toString().trim() || '',
    status: row[2]?.toString().toUpperCase().trim() || 'NONAKTIF',
  })).filter(user => user.uid);
}

// Ambil data power meter dari sheet Log_Monitoring_Energi_PM2230
export async function getPowerData(spreadsheetId: string, limit: number = 100) {
  const data = await getSheetData(spreadsheetId, 'Log_Monitoring_Energi_PM2230!A:G');
  if (!data || data.length < 2) return [];
  
  // Asumsi kolom: A(Timestamp), B(vAvg), C(iAvg), D(pTot), E(hz), F(kwh), G(status)
  const rows = data.slice(1);
  return rows.slice(-limit).map((row, index) => {
    // Parse timestamp dari format "dd/MM/yyyy HH:mm:ss"
    const timestamp = row[0] || '';
    const [date, time] = timestamp.split(' ');
    const [day, month, year] = date?.split('/') || [];
    
    return {
      timestamp: year && month && day ? `${year}-${month}-${day}T${time}` : new Date().toISOString(),
      voltageAvg: parseFloat(row[1]) || 0,
      currentAvg: parseFloat(row[2]) || 0,
      powerTotal: parseFloat(row[3]) || 0,
      frequency: parseFloat(row[4]) || 0,
      energyKwh: parseFloat(row[5]) || 0,
      status: row[6] || 'Unknown',
      idMesin: 'MESIN_01' // Default, karena tidak dikirim dari ESP32
    };
  }).reverse();
}