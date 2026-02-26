// app/dashboard/access-control/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Home, ArrowLeft, Shield, Users, Activity, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface RFIDLog {
  id: string;
  no: number;
  timestamp: string;
  idMesin: string;
  waktuOn: string;
  waktuOff: string;
  uid: string;
  namaUser: string | null;
  statusSesi: string;
  durasi: string;
  user?: {
    uid: string;
    nama: string;
    status: string;
  } | null;
}

interface User {
  uid: string;
  nama: string;
  status: string;
}

interface Stats {
  totalLogs: number;
  activeSessions: number;
  deniedAccess: number;
  powerLoss: number;
  totalUsers: number;
  activeUsers: number;
  todayAccess: number;
}

export default function AccessControlPage() {
  const [logs, setLogs] = useState<RFIDLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('logs');

  useEffect(() => {
    fetchData();
    // Refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setError(null);
      
      // Fetch logs
      const logsRes = await fetch('../../api/rfid-logs?limit=100');
      if (!logsRes.ok) {
        throw new Error(`Failed to fetch logs: ${logsRes.status}`);
      }
      const logsText = await logsRes.text();
      const logsData = logsText ? JSON.parse(logsText) : [];
      setLogs(logsData);

      // Fetch users
      const usersRes = await fetch('../../api/user-list');
      if (!usersRes.ok) {
        throw new Error(`Failed to fetch users: ${usersRes.status}`);
      }
      const usersText = await usersRes.text();
      const usersData = usersText ? JSON.parse(usersText) : [];
      setUsers(usersData);

      // Fetch stats
      const statsRes = await fetch('../../api/stats');
      if (!statsRes.ok) {
        throw new Error(`Failed to fetch stats: ${statsRes.status}`);
      }
      const statsText = await statsRes.text();
      const statsData = statsText ? JSON.parse(statsText) : {
        totalLogs: 0,
        activeSessions: 0,
        deniedAccess: 0,
        powerLoss: 0,
        totalUsers: 0,
        activeUsers: 0
      };
      setStats(statsData);

    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
      
      // Set default values on error
      setLogs([]);
      setUsers([]);
      setStats({
        totalLogs: 0,
        activeSessions: 0,
        deniedAccess: 0,
        powerLoss: 0,
        totalUsers: 0,
        activeUsers: 0,
        todayAccess: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      'ON': { color: 'bg-green-500', label: 'ON' },
      'OFF': { color: 'bg-blue-500', label: 'OFF' },
      'DITOLAK': { color: 'bg-red-500', label: 'DITOLAK' },
      'OFF (Power Loss)': { color: 'bg-yellow-500', label: 'POWER LOSS' },
      'Terputus': { color: 'bg-gray-500', label: 'TERPUTUS' },
    };

    const statusInfo = statusMap[status] || { color: 'bg-gray-500', label: status };
    
    return (
      <Badge className={`${statusInfo.color} text-white`}>
        {statusInfo.label}
      </Badge>
    );
  };

  const getUserStatusBadge = (status: string) => {
    return status === 'AKTIF' ? (
      <Badge className="bg-green-500 text-white">AKTIF</Badge>
    ) : (
      <Badge variant="destructive">NONAKTIF</Badge>
    );
  };

  const getDurasiBadge = (durasi: string, statusSesi: string) => {
    if (statusSesi === 'DITOLAK') {
      return <Badge variant="destructive">Akses Ilegal</Badge>;
    }
    if (durasi?.includes('Terputus')) {
      return <Badge variant="secondary">Terputus</Badge>;
    }
    return <span>{durasi || '-'}</span>;
  };

  const filteredLogs = logs.filter(log => 
    log.uid?.toLowerCase().includes(filter.toLowerCase()) ||
    log.namaUser?.toLowerCase().includes(filter.toLowerCase()) ||
    log.idMesin?.toLowerCase().includes(filter.toLowerCase())
  );

  const filteredUsers = users.filter(user => 
    user.uid?.toLowerCase().includes(filter.toLowerCase()) ||
    user.nama?.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading access control data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header dengan navigasi */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/home">
            <Button variant="ghost" size="icon" className="mr-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Access Control System
            </h1>
            <p className="text-gray-500 mt-1">Monitoring akses RFID dan user management</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/dashboard/home">
            <Button variant="outline">
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          
          <div className="w-72">
            <Input
              placeholder="Filter by UID, Nama, atau Mesin..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}. Menampilkan data yang tersedia.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                Total Akses
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.totalLogs}</div>
                <p className="text-xs text-gray-500 mt-1">
                Hari ini: {stats.todayAccess}
                </p>
            </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-600" />
                Mesin Aktif
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-green-600">
                {stats.activeSessions}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                Sedang beroperasi
                </p>
            </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-600" />
                Akses Ditolak
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-red-600">
                {stats.deniedAccess}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                Ilegal attempts
                </p>
            </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-yellow-600" />
                Power Loss
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                {stats.powerLoss}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                Gangguan listrik
                </p>
            </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                Total User
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <p className="text-xs text-gray-500 mt-1">
                Terdaftar
                </p>
            </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-green-600" />
                User Aktif
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-green-600">
                {stats.activeUsers}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                Dapat mengakses
                </p>
            </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow md:col-span-2">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                Ringkasan
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-sm text-gray-500">Success Rate</p>
                    <p className="text-xl font-bold">
                    {stats.totalLogs > 0 
                        ? Math.round(((stats.totalLogs - stats.deniedAccess) / stats.totalLogs) * 100) 
                        : 0}%
                    </p>
                </div>
                <div>
                    <p className="text-sm text-gray-500">User Aktif</p>
                    <p className="text-xl font-bold">
                    {stats.totalUsers > 0 
                        ? Math.round((stats.activeUsers / stats.totalUsers) * 100) 
                        : 0}%
                    </p>
                </div>
                </div>
            </CardContent>
            </Card>
        </div>
        )}
      {/* Tabs for Logs and User List */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="logs">Akses Logs</TabsTrigger>
          <TabsTrigger value="users">User List</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Akses RFID</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">No</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>ID Mesin</TableHead>
                      <TableHead>Waktu ON</TableHead>
                      <TableHead>Waktu OFF</TableHead>
                      <TableHead>UID</TableHead>
                      <TableHead>Nama User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Durasi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                          {filter ? 'Tidak ada data sesuai filter' : 'Belum ada data akses'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <TableCell className="font-medium">{log.no}</TableCell>
                          <TableCell>
                            {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {log.idMesin}
                            </Badge>
                          </TableCell>
                          <TableCell>{log.waktuOn || '-'}</TableCell>
                          <TableCell>{log.waktuOff || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.uid}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{log.namaUser || <span className="text-red-500">Unknown</span>}</span>
                              {log.user && log.user.status === 'NONAKTIF' && (
                                <Badge variant="destructive" className="text-xs">
                                  Nonaktif
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(log.statusSesi)}</TableCell>
                          <TableCell>
                            {getDurasiBadge(log.durasi || '-', log.statusSesi)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daftar User RFID</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">No</TableHead>
                      <TableHead>UID RFID</TableHead>
                      <TableHead>Nama User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total Akses</TableHead>
                      <TableHead>Terakhir Akses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                          {filter ? 'Tidak ada user sesuai filter' : 'Belum ada user terdaftar'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user, index) => {
                        const userLogs = logs.filter(l => l.uid === user.uid);
                        const lastAccess = userLogs[0]?.timestamp;
                        
                        return (
                          <TableRow key={user.uid} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {user.uid}
                            </TableCell>
                            <TableCell className="font-medium">
                              {user.nama}
                            </TableCell>
                            <TableCell>
                              {getUserStatusBadge(user.status)}
                            </TableCell>
                            <TableCell>{userLogs.length}</TableCell>
                            <TableCell>
                              {lastAccess ? (
                                format(new Date(lastAccess), 'dd/MM/yyyy HH:mm')
                              ) : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="flex justify-center gap-4 pt-4 border-t">
        <Link href="/dashboard/home">
          <Button variant="link" className="text-blue-600">
            <Home className="w-4 h-4 mr-2" />
            Kembali ke Dashboard
          </Button>
        </Link>
        <Button variant="link" className="text-green-600" onClick={fetchData}>
          <Activity className="w-4 h-4 mr-2" />
          Refresh Data
        </Button>
      </div>
    </div>
  );
}