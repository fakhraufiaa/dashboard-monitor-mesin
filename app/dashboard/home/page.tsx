// app/dashboard/page.tsx (dengan penyesuaian untuk data baru)
'use client';

import { useEffect, useState, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RefreshCw, Activity, Zap, GaugeIcon, Battery, Shield, Users, AlertCircle } from 'lucide-react';
import Link from 'next/link';

// Interface baru sesuai data dari ESP32
interface PowerData {
  id?: string;
  idMesin: string;
  timestamp: string;
  // Data baru dari sheet monitoring
  voltageAvg: number;      // vAvg dari ESP32
  currentAvg: number;      // iAvg dari ESP32
  powerTotal: number;      // pTot dalam Watt
  frequency: number;       // hz dari ESP32
  energyKwh: number;       // kwh dari ESP32
  status?: string;
  
  // Untuk kompatibilitas dengan chart (opsional)
  voltageA?: number;
  voltageB?: number;
  voltageC?: number;
  currentA?: number;
  currentB?: number;
  currentC?: number;
  powerActive?: number;
}

export default function DashboardPage() {
  const [selectedMachine, setSelectedMachine] = useState('MESIN_01');
  const [powerData, setPowerData] = useState<PowerData[]>([]);
  const [latestData, setLatestData] = useState<PowerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    todayAccess: 0,
    activeSessions: 0,
    totalUsers: 0,
    activeUsers: 0
  });

  useEffect(() => {
    fetchPowerData();
    fetchStats();
  }, [selectedMachine]);

  useEffect(() => {
    if (!isLive) return;

    const eventSource = new EventSource(
      `/api/power-data/stream?idMesin=${selectedMachine}`
    );

    eventSource.onmessage = (event) => {
      try {
        const newData = JSON.parse(event.data);
        setConnectionError(null);
        
        if (newData && newData.idMesin) {
          setLatestData(newData);
          setPowerData((prev) => {
            const updated = [...prev, newData];
            return updated.slice(-60);
          });
        }
      } catch (e) {
        console.error('Error parsing SSE data:', e);
      }
    };

    eventSource.onerror = () => {
      setConnectionError('Koneksi ke server terputus');
    };

    return () => eventSource.close();
  }, [selectedMachine, isLive]);

  const fetchPowerData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`../../api/power-data/latest?idMesin=${selectedMachine}&limit=60`);
      const data = await res.json();
      setPowerData(data);
      setLatestData(data[data.length - 1] || null);
    } catch (error) {
      console.error('Error fetching power data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('../../api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats({
          todayAccess: data.todayAccess || 0,
          activeSessions: data.activeSessions || 0,
          totalUsers: data.totalUsers || 0,
          activeUsers: data.activeUsers || 0
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  const machines = ['MESIN_01', 'MESIN_02', 'MESIN_03'];

  // Hitung daya dalam kW (konversi dari Watt)
//   const powerKW = latestData?.powerTotal ? (latestData.powerTotal / 1000).toFixed(2) : '0';

  return (
    <div className="p-6 space-y-6">
      {/* Header (sama seperti sebelumnya) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Monitoring Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Real-time monitoring dari PM2230</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="../dashboard/access-control">
            <Button variant="outline" className="border-blue-200 hover:bg-blue-50">
              <Shield className="w-4 h-4 mr-2 text-blue-600" />
              Access Control
            </Button>
          </Link>

          <Select value={selectedMachine} onValueChange={setSelectedMachine}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Pilih Mesin" />
            </SelectTrigger>
            <SelectContent>
              {machines.map((machine) => (
                <SelectItem key={machine} value={machine}>
                  {machine.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            variant={isLive ? "default" : "outline"}
            onClick={() => setIsLive(!isLive)}
            className={isLive ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <Activity className={`w-4 h-4 mr-2 ${isLive ? "animate-pulse" : ""}`} />
            {isLive ? "LIVE" : "PAUSED"}
          </Button>
          
          <Button variant="outline" onClick={fetchPowerData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {connectionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Koneksi Error</AlertTitle>
          <AlertDescription>{connectionError}</AlertDescription>
        </Alert>
      )}

      {/* Status Ringkas Access Control */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="../dashboard/access-control" className="block">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-blue-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Akses Hari Ini</p>
                  <p className="text-2xl font-bold">{stats.todayAccess}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-green-600">{stats.activeSessions} aktif</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="../dashboard/access-control?tab=UserList" className="block">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-green-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total User</p>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-green-600">{stats.activeUsers} aktif</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-full">
                  <Activity className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Interval Data</p>
                  <p className="text-2xl font-bold">30 detik</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">
                  {latestData?.timestamp ? formatTime(latestData.timestamp) : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards Utama untuk Power Meter */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tegangan Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              Tegangan Rata-rata (L-L)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">
              {latestData?.voltageAvg?.toFixed(1) || '0'} <span className="text-lg">V</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Voltage Line to Line Average</p>
          </CardContent>
        </Card>

        {/* Arus Card */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-600" />
              Arus Rata-rata
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">
              {latestData?.currentAvg?.toFixed(1) || '0'} <span className="text-lg">A</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Current Average</p>
          </CardContent>
        </Card>

       {/* Daya Card - langsung pakai latestData.powerTotal */}
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <GaugeIcon className="w-4 h-4 text-purple-600" />
            Daya Total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-purple-700">
            {latestData?.powerTotal 
              ? (latestData.powerTotal / 1000).toFixed(2) 
              : '0'} <span className="text-lg">kW</span>
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-gray-500">Frekuensi:</span>
            <span className="font-semibold">{latestData?.frequency|| '0'} Hz</span>
          </div>
        </CardContent>
      </Card>

        {/* Energi Card */}
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Battery className="w-4 h-4 text-amber-600" />
              Total Energi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700">
              {latestData?.energyKwh || '0'} <span className="text-lg">kWh</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Accumulated Energy</p>
          </CardContent>
        </Card>
      </div>

      {/* Grafik Tegangan (sekarang hanya 1 line) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Tegangan Rata-rata (V LL) - Real-time</span>
            {isLive && !connectionError && (
              <span className="flex items-center gap-1 text-xs font-normal text-green-600">
                <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
                Live
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : powerData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                Menunggu data dari ESP32...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={powerData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={formatTime}
                    interval="preserveStartEnd"
                  />
                  <YAxis domain={['auto', 'auto']} />
                  <Tooltip 
                    labelFormatter={(label) => new Date(label).toLocaleString('id-ID')}
                    formatter={(value: any) => [`${value.toFixed(1)} V`, 'Tegangan']}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="voltageAvg" 
                    stroke="#8884d8" 
                    name="V LL Average"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Grafik Arus */}
      <Card>
        <CardHeader>
          <CardTitle>Arus Rata-rata (A)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={powerData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatTime}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(label) => new Date(label).toLocaleString('id-ID')}
                  formatter={(value: any) => [`${value.toFixed(1)} A`, 'Arus']}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="currentAvg" 
                  stroke="#82ca9d" 
                  name="Arus Rata-rata"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Grafik Daya - LANGSUNG dari database (dalam kW) */}
        <Card>
        <CardHeader>
            <CardTitle>Daya Total (kW)</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={powerData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={formatTime}
                />
                <YAxis />
                <Tooltip 
                    labelFormatter={(label) => new Date(label).toLocaleString('id-ID')}
                    formatter={(value: any) => [`${value.toFixed(2)} kW`, 'Daya']}
                />
                <Legend />
                <Line 
                    type="monotone" 
                    dataKey="powerTotal"  // ← LANGSUNG pakai powerTotal (dalam kW)
                    stroke="#ffc658" 
                    name="Daya Total"
                    dot={false}
                />
                </LineChart>
            </ResponsiveContainer>
            </div>
        </CardContent>
        </Card>

      {/* Footer */}
      <div className="flex justify-center gap-4 pt-4 border-t">
        <Link href="../dashboard/access-control">
          <Button variant="link" className="text-blue-600">
            <Shield className="w-4 h-4" />
            Lihat Detail Access Control
          </Button>
        </Link>
      </div>
    </div>
  );
}