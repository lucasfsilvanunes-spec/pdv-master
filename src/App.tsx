/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Wallet, 
  BarChart3, 
  Plus, 
  Search, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft,
  LogOut,
  Users,
  Store,
  FileText,
  Printer,
  Wifi,
  WifiOff,
  History,
  CheckCircle2,
  XCircle,
  FileDown,
  Info,
  Edit2,
  X,
  User,
  Settings,
  Lock,
  Headset,
  ShieldCheck,
  AlertTriangle,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  setDoc,
  deleteDoc, 
  orderBy, 
  where,
  Timestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';

import { db, auth, handleFirestoreError, OperationType } from './lib/firebase';
import { Product, Sale, SaleItem, CashTransaction, SalePayment, PaymentMethod, Customer, CashierSession, Invoice, UserProfile } from './types';
import { PAYMENT_METHODS, TRANSACTION_CATEGORIES } from './constants';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast, Toaster } from 'sonner';
import { Onboarding } from './components/Onboarding';
import { AdminDashboard } from './components/AdminDashboard';
import { Plans } from './components/Plans';
import { FeedbackModal } from './components/FeedbackModal';
import { InstallPWA } from './components/InstallPWA';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [networkTime, setNetworkTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sessions, setSessions] = useState<CashierSession[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const activeSession = useMemo(() => sessions.find(s => s.status === 'open'), [sessions]);

  // Offline Detection
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auth State & User Profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const isDeveloper = firebaseUser.email?.toLowerCase() === "lucasfsilvanunes@gmail.com";
        // Fetch or Create User Profile
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        let profile: UserProfile;
        if (userSnap.exists()) {
          profile = { id: userSnap.id, ...userSnap.data() } as UserProfile;
          
          // Force active for developer if stored state is different
          if (isDeveloper && (!profile.isActive || new Date(profile.validityDate) < new Date())) {
            const updatedProfile = {
              ...profile,
              isActive: true,
              validityDate: "2099-12-31T23:59:59.999Z",
              role: 'admin' as const
            };
            await updateDoc(userRef, { 
              isActive: true, 
              validityDate: updatedProfile.validityDate,
              role: 'admin'
            });
            profile = updatedProfile;
          }
        } else {
          // Create default profile for first-time login
          const newProfile: Omit<UserProfile, 'id'> = {
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || '',
            isActive: isDeveloper, // Developer is auto-active
            validityDate: isDeveloper ? "2099-12-31T23:59:59.999Z" : subDays(new Date(), 1).toISOString(),
            role: isDeveloper ? 'admin' as const : 'user' as const,
            createdAt: new Date().toISOString()
          };
          await setDoc(userRef, newProfile);
          profile = { id: firebaseUser.uid, ...newProfile } as UserProfile;
        }
        
        setUserProfile(profile);
        setNeedsOnboarding(!profile.trialUsed && !isDeveloper);

        // Fetch Network Time with fallbacks
        const fetchTime = async () => {
          const endpoints = [
            'https://worldtimeapi.org/api/timezone/Etc/UTC',
            'https://timeapi.io/api/Time/current/zone?timeZone=UTC'
          ];
          
          for (const url of endpoints) {
            try {
              const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
              if (!resp.ok) continue;
              const data = await resp.json();
              const dateStr = data.utc_datetime || data.dateTime;
              if (dateStr) {
                setNetworkTime(new Date(dateStr));
                return;
              }
            } catch (e) {
              console.warn(`Failed to fetch time from ${url}:`, e);
            }
          }
          
          // Last resort fallback to local time if all APIs fail
          setNetworkTime(new Date());
        };
        fetchTime();
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Data Sync
  useEffect(() => {
    if (!user) return;

    const productsUnsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(productsData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'products')
    );

    const salesUnsubscribe = onSnapshot(
      query(collection(db, 'sales'), where('userId', '==', user.uid), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
        setSales(salesData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'sales')
    );

    const transactionsUnsubscribe = onSnapshot(
      query(collection(db, 'transactions'), where('userId', '==', user.uid), orderBy('date', 'desc')),
      (snapshot) => {
        const transactionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashTransaction));
        setTransactions(transactionsData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'transactions')
    );

    const customersUnsubscribe = onSnapshot(
      query(collection(db, 'customers'), where('userId', '==', user.uid)),
      (snapshot) => {
        const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        setCustomers(customersData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'customers')
    );

    const sessionsUnsubscribe = onSnapshot(
      query(collection(db, 'cashier_sessions'), where('userId', '==', user.uid), orderBy('openedAt', 'desc')),
      (snapshot) => {
        const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashierSession));
        setSessions(sessionsData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'cashier_sessions')
    );

    const invoicesUnsubscribe = onSnapshot(
      query(collection(db, 'invoices'), where('userId', '==', user.uid)),
      (snapshot) => {
        const invoicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
        setInvoices(invoicesData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices')
    );

    return () => {
      productsUnsubscribe();
      salesUnsubscribe();
      transactionsUnsubscribe();
      customersUnsubscribe();
      sessionsUnsubscribe();
      invoicesUnsubscribe();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Login realizado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao fazer login.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logout realizado.');
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-900 border-t-transparent" />
          <p className="text-sm font-medium animate-pulse">Iniciando PDV Master...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8 text-center"
        >
          <div className="space-y-2">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 text-white">
              <ShoppingCart className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">PDV Master</h1>
            <p className="text-zinc-500">Gerencie suas vendas, estoque e finanças em um só lugar.</p>
          </div>
          <Button onClick={handleLogin} size="lg" className="w-full gap-2 rounded-xl py-6 text-lg">
            <User className="h-5 w-5" />
            Entrar com Google
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      {user && userProfile && needsOnboarding && (
        <Onboarding 
          user={user} 
          profile={userProfile} 
          onComplete={(updated) => {
            setUserProfile(updated);
            setNeedsOnboarding(false);
          }} 
        />
      )}
      <RestrictedAccessScreen 
        profile={userProfile} 
        networkTime={networkTime} 
        onSupport={() => window.open('https://wa.me/5519997096089?text=Olá, gostaria de renovar minha assinatura do PDV Master.', '_blank')} 
        onLogout={handleLogout}
        onPlans={() => setActiveTab('plans')}
      />
      
      <div className="flex h-screen bg-zinc-50">
        {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-white p-4 md:flex">
        <div className="mb-4 flex items-center justify-between gap-2 px-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">PDV Master</span>
          </div>
          {isOffline ? (
            <div className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
              <WifiOff className="h-3 w-3" />
              OFFLINE
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-600">
              <Wifi className="h-3 w-3" />
              ON
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1">
          <SidebarLink 
            icon={<LayoutDashboard className="h-5 w-5" />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarLink 
            icon={<Store className="h-5 w-5" />} 
            label="Caixa" 
            active={activeTab === 'cashier'} 
            onClick={() => setActiveTab('cashier')} 
          />
          <SidebarLink 
            icon={<ShoppingCart className="h-5 w-5" />} 
            label="Vendas (PDV)" 
            active={activeTab === 'pos'} 
            onClick={() => setActiveTab('pos')} 
          />
          <SidebarLink 
            icon={<Users className="h-5 w-5" />} 
            label="Clientes" 
            active={activeTab === 'customers'} 
            onClick={() => setActiveTab('customers')} 
          />
          <SidebarLink 
            icon={<Package className="h-5 w-5" />} 
            label="Estoque" 
            active={activeTab === 'inventory'} 
            onClick={() => setActiveTab('inventory')} 
          />
          <SidebarLink 
            icon={<Wallet className="h-5 w-5" />} 
            label="Fluxo de Caixa" 
            active={activeTab === 'cashflow'} 
            onClick={() => setActiveTab('cashflow')} 
          />
          <SidebarLink 
            icon={<BarChart3 className="h-5 w-5" />} 
            label="Relatórios" 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')} 
          />
          <SidebarLink 
            icon={<ShieldCheck className="h-5 w-5 text-indigo-600" />} 
            label="Planos de Acesso" 
            active={activeTab === 'plans'} 
            onClick={() => setActiveTab('plans')} 
          />
          <SidebarLink 
            icon={<MessageSquare className="h-5 w-5 text-zinc-500" />} 
            label="Enviar Feedback" 
            active={false} 
            onClick={() => setIsFeedbackOpen(true)} 
          />
          {userProfile?.role === 'admin' && (
            <SidebarLink 
              icon={<ShieldCheck className="h-5 w-5" />} 
              label="Admin" 
              active={activeTab === 'admin'} 
              onClick={() => setActiveTab('admin')} 
            />
          )}
        </nav>

        <div className="mt-auto space-y-4 pt-4 px-2 pb-2">
          <InstallPWA />
          <Separator />
          <div className="flex items-center gap-3">
            <img src={user.photoURL || ''} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{user.displayName}</p>
              <p className="truncate text-xs text-zinc-500">{user.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Dashboard products={products} sales={sales} transactions={transactions} />
              </motion.div>
            )}
            {activeTab === 'cashier' && (
              <motion.div key="cashier" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CashierManagement sessions={sessions} user={user} sales={sales} transactions={transactions} />
              </motion.div>
            )}
            {activeTab === 'pos' && (
              <motion.div key="pos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <POS products={products} user={user} customers={customers} activeSession={activeSession} setActiveTab={setActiveTab} sales={sales} />
              </motion.div>
            )}
            {activeTab === 'customers' && (
              <motion.div key="customers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CustomerManagement customers={customers} user={user} />
              </motion.div>
            )}
            {activeTab === 'inventory' && (
              <motion.div key="inventory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Inventory products={products} user={user} />
              </motion.div>
            )}
            {activeTab === 'cashflow' && (
              <motion.div key="cashflow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CashFlow transactions={transactions} user={user} />
              </motion.div>
            )}
            {activeTab === 'reports' && (
              <motion.div key="reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Reports sales={sales} transactions={transactions} />
              </motion.div>
            )}
            {activeTab === 'admin' && userProfile?.role === 'admin' && (
              <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <AdminDashboard />
              </motion.div>
            )}
            {activeTab === 'plans' && (
              <motion.div key="plans" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Plans user={user!} onContinue={() => setActiveTab('dashboard')} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      
      {userProfile && (
        <FeedbackModal 
          isOpen={isFeedbackOpen} 
          onClose={() => setIsFeedbackOpen(false)} 
          user={userProfile} 
        />
      )}
    </div>
  </>
);
}

function SidebarLink({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active 
          ? 'bg-zinc-900 text-white' 
          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// --- Restricted Access Screen Component ---
function RestrictedAccessScreen({ profile, networkTime, onSupport, onLogout, onPlans }: { profile: UserProfile | null, networkTime: Date | null, onSupport: () => void, onLogout: () => void, onPlans: () => void }) {
  const isLifetime = profile?.email?.toLowerCase() === "lucasfsilvanunes@gmail.com";
  
  const isExpired = useMemo(() => {
    if (isLifetime) return false;
    if (!profile || !networkTime) return false;
    const validity = new Date(profile.validityDate);
    return networkTime > validity;
  }, [profile, networkTime, isLifetime]);

  const isActive = isLifetime || (profile?.isActive ?? false);

  if (!profile) return null; 

  if (isActive && !isExpired) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/98 backdrop-blur-xl p-6">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-3xl text-center space-y-8 border border-zinc-200"
      >
        <div className="mx-auto w-24 h-24 bg-red-50 rounded-3xl flex items-center justify-center relative">
          <Lock className="h-12 w-12 text-red-600" />
          <motion.div 
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 bg-red-400/10 rounded-3xl animate-pulse"
          />
        </div>
        
        <div className="space-y-3">
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Assinatura Vencida ou Acesso Não Autorizado</h2>
          <p className="text-zinc-500 text-sm leading-relaxed px-2">
            Infelizmente, identificamos que seu acesso ao <strong>PDV Master</strong> expirou ou seu perfil está inativo no momento.
          </p>
        </div>

        <div className="bg-zinc-50 rounded-2xl p-5 text-left border border-zinc-100 space-y-3">
          <div className="flex items-center gap-3 text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
            <ShieldCheck className="h-4 w-4" />
            <span>Status da Conta</span>
          </div>
          <div className="flex justify-between items-center text-sm border-t border-zinc-100 pt-3">
            <span className="font-medium text-zinc-500">Última Validade:</span>
            <span className="font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full">
              {format(new Date(profile.validityDate), "dd/MM/yyyy")}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button onClick={onPlans} size="lg" className="w-full gap-2 rounded-2xl py-7 h-auto text-lg bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20">
            <ShieldCheck className="h-5 w-5" /> Ver Planos de Assinatura
          </Button>

          <Button onClick={onSupport} variant="outline" size="lg" className="w-full gap-2 rounded-2xl py-7 h-auto text-lg border-green-200 text-green-700 hover:bg-green-50">
            <Headset className="h-5 w-5" /> WhatsApp Suporte
          </Button>
          
          <Button variant="ghost" onClick={onLogout} className="w-full gap-2 rounded-2xl py-4 h-auto text-sm text-zinc-400 hover:bg-zinc-50">
            <LogOut className="h-4 w-4" /> Entrar com outra conta
          </Button>
        </div>

        <div className="flex flex-col items-center gap-2 text-[10px] text-zinc-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3 w-3" />
            <span className="font-medium">Segurança PDV Master: Sincronização via UTC Global</span>
          </div>
          {profile.trialUsed && <span className="text-zinc-300 italic">Período de teste já utilizado nesta conta.</span>}
        </div>
      </motion.div>
    </div>
  );
}

// --- Dashboard Component ---
function Dashboard({ products, sales, transactions }: { products: Product[], sales: Sale[], transactions: CashTransaction[] }) {
  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const todaySales = sales.filter(s => new Date(s.createdAt) >= today);
    const totalRevenue = todaySales.reduce((acc, s) => acc + s.total, 0);
    
    const lowStock = products.filter(p => p.stock <= 5).length;
    
    const cashIn = transactions.filter(t => t.type === 'in').reduce((acc, t) => acc + t.amount, 0);
    const cashOut = transactions.filter(t => t.type === 'out').reduce((acc, t) => acc + t.amount, 0);
    const balance = cashIn - cashOut;

    return { totalRevenue, salesCount: todaySales.length, lowStock, balance };
  }, [products, sales, transactions]);

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const daySales = sales.filter(s => {
        const saleDate = new Date(s.createdAt);
        return saleDate >= startOfDay(date) && saleDate <= endOfDay(date);
      });
      return {
        name: format(date, 'dd/MM'),
        total: daySales.reduce((acc, s) => acc + s.total, 0)
      };
    });
    return last7Days;
  }, [sales]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="text-sm text-zinc-500">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Vendas Hoje" value={`R$ ${stats.totalRevenue.toFixed(2)}`} icon={<ShoppingCart className="h-4 w-4" />} description={`${stats.salesCount} vendas realizadas`} />
        <StatCard title="Saldo em Caixa" value={`R$ ${stats.balance.toFixed(2)}`} icon={<Wallet className="h-4 w-4" />} description="Entradas - Saídas" />
        <StatCard title="Estoque Baixo" value={stats.lowStock.toString()} icon={<Package className="h-4 w-4" />} description="Produtos com menos de 5 unid." variant={stats.lowStock > 0 ? 'destructive' : 'default'} />
        <StatCard title="Ticket Médio" value={`R$ ${stats.salesCount > 0 ? (stats.totalRevenue / stats.salesCount).toFixed(2) : '0.00'}`} icon={<BarChart3 className="h-4 w-4" />} description="Média por venda hoje" />
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle>Vendas nos últimos 7 dias</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} tickFormatter={(value) => `R$${value}`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
                />
                <Line type="monotone" dataKey="total" stroke="#18181b" strokeWidth={2} dot={{ r: 4, fill: '#18181b' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Vendas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sales.slice(0, 5).map((sale) => (
                <div key={sale.id} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">Venda #{sale.id.slice(-4)}</p>
                    <p className="text-xs text-zinc-500">{format(new Date(sale.createdAt), 'HH:mm')}</p>
                  </div>
                  <div className="text-sm font-medium">+R$ {sale.total.toFixed(2)}</div>
                </div>
              ))}
              {sales.length === 0 && <p className="text-center text-sm text-zinc-500">Nenhuma venda hoje.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

function StatCard({ title, value, icon, description, variant = 'default' }: { title: string, value: string, icon: React.ReactNode, description: string, variant?: 'default' | 'destructive' }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`rounded-md p-1 ${variant === 'destructive' ? 'bg-red-100 text-red-600' : 'bg-zinc-100 text-zinc-600'}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${variant === 'destructive' ? 'text-red-600' : ''}`}>{value}</div>
        <p className="text-xs text-zinc-500">{description}</p>
      </CardContent>
    </Card>
  );
}

// --- Customer Management Component ---
function CustomerManagement({ customers, user }: { customers: Customer[], user: FirebaseUser }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    address: ''
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        userId: user.uid,
        createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString()
      };

      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), data);
        toast.success('Cliente atualizado!');
      } else {
        await addDoc(collection(db, 'customers'), data);
        toast.success('Cliente cadastrado!');
      }
      setIsAddOpen(false);
      setEditingCustomer(null);
      setFormData({ name: '', email: '', phone: '', cpf: '', address: '' });
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar cliente.');
    }
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      cpf: c.cpf || '',
      address: c.address || ''
    });
    setIsAddOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Gestão de Clientes</h2>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger
            render={
              <Button onClick={() => { setEditingCustomer(null); setFormData({ name: '', email: '', phone: '', cpf: '', address: '' }); }} className="gap-2" />
            }
          >
            <Plus className="h-4 w-4" /> Novo Cliente
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cpf">CPF / CNPJ</Label>
                <Input id="cpf" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Endereço</Label>
                <Input id="address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full">Salvar Cliente</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  <div className="flex flex-col text-xs">
                    <span>{c.email}</span>
                    <span className="text-zinc-500">{c.phone}</span>
                  </div>
                </TableCell>
                <TableCell>{c.cpf}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-zinc-500">
                  Nenhum cliente cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// --- Cashier Management Component ---
function CashierManagement({ sessions, user, sales, transactions }: { sessions: CashierSession[], user: FirebaseUser, sales: Sale[], transactions: CashTransaction[] }) {
  const [isOpening, setIsOpening] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');
  const [reportedBalance, setReportedBalance] = useState('');

  const activeSession = sessions.find(s => s.status === 'open');

  const handleOpenCashier = async () => {
    try {
      const amount = parseFloat(openingBalance) || 0;
      await addDoc(collection(db, 'cashier_sessions'), {
        openedAt: new Date().toISOString(),
        openingBalance: amount,
        expectedClosingBalance: amount,
        status: 'open',
        userId: user.uid
      });
      toast.success('Caixa aberto com sucesso!');
      setIsOpening(false);
      setOpeningBalance('');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao abrir o caixa.');
    }
  };

  const handleCloseCashier = async () => {
    if (!activeSession) return;
    try {
      const reported = parseFloat(reportedBalance) || 0;
      await updateDoc(doc(db, 'cashier_sessions', activeSession.id), {
        closedAt: new Date().toISOString(),
        reportedClosingBalance: reported,
        status: 'closed'
      });
      toast.success('Caixa fechado com sucesso!');
      setIsClosing(false);
      setReportedBalance('');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao fechar o caixa.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Fluxo de Caixa / Turno</h2>
        {!activeSession ? (
          <Button onClick={() => setIsOpening(true)} className="gap-2 bg-green-600 hover:bg-green-700">
            <CheckCircle2 className="h-4 w-4" /> Abrir Caixa
          </Button>
        ) : (
          <Button variant="destructive" onClick={() => setIsClosing(true)} className="gap-2">
            <XCircle className="h-4 w-4" /> Fechar Caixa
          </Button>
        )}
      </div>

      {activeSession ? (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Caixa Aberto</CardTitle>
                <CardDescription>Iniciado em {format(new Date(activeSession.openedAt), 'dd/MM/yyyy HH:mm')}</CardDescription>
              </div>
              <Badge className="bg-green-600">EM OPERAÇÃO</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <span className="text-xs text-zinc-500 uppercase font-bold">Saldo Inicial</span>
                <p className="text-2xl font-bold">R$ {activeSession.openingBalance.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-zinc-500 uppercase font-bold">Total Vendas (Turno)</span>
                <p className="text-2xl font-bold text-green-600">
                  R$ {sales.filter(s => new Date(s.createdAt) >= new Date(activeSession.openedAt)).reduce((acc, s) => acc + s.total, 0).toFixed(2)}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-zinc-500 uppercase font-bold">Saldo Esperado</span>
                <p className="text-2xl font-bold">
                  R$ {(activeSession.openingBalance + transactions
                      .filter(t => new Date(t.date) >= new Date(activeSession.openedAt))
                      .reduce((acc, t) => acc + (t.type === 'in' ? t.amount : -t.amount), 0)).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed flex flex-col items-center justify-center p-12 text-center text-zinc-500">
          <Store className="h-12 w-12 mb-4 opacity-20" />
          <p>O caixa está fechado no momento.</p>
          <p className="text-sm">Abra o caixa para iniciar as operações de venda.</p>
        </Card>
      )}

      <div>
        <h3 className="mb-4 text-lg font-bold">Histórico de Turnos</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Abertura</TableHead>
                <TableHead>Fechamento</TableHead>
                <TableHead>Inicial</TableHead>
                <TableHead>Final (Relatado)</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.filter(s => s.status === 'closed').map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs">{format(new Date(s.openedAt), 'dd/MM HH:mm')}</TableCell>
                  <TableCell className="text-xs">{s.closedAt ? format(new Date(s.closedAt), 'dd/MM HH:mm') : '-'}</TableCell>
                  <TableCell>R$ {s.openingBalance.toFixed(2)}</TableCell>
                  <TableCell>R$ {s.reportedClosingBalance?.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {s.reportedClosingBalance !== undefined && (
                      <span className={s.reportedClosingBalance >= s.expectedClosingBalance ? 'text-green-600' : 'text-red-600'}>
                        R$ {(s.reportedClosingBalance - s.expectedClosingBalance).toFixed(2)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Modals */}
      <Dialog open={isOpening} onOpenChange={setIsOpening}>
        <DialogContent>
          <DialogHeader><DialogTitle>Abrir Caixa</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Fundo de Caixa (Troco Inicial)</Label>
              <Input type="number" step="0.01" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleOpenCashier} className="w-full">Confirmar Abertura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isClosing} onOpenChange={setIsClosing}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fechar Caixa</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Valor Total em Dinheiro + Comprovantes</Label>
              <Input type="number" step="0.01" value={reportedBalance} onChange={e => setReportedBalance(e.target.value)} placeholder="0.00" />
            </div>
            {activeSession && (
              <div className="rounded-lg bg-zinc-50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Saldo Esperado:</span>
                  <span className="font-bold">R$ {activeSession.expectedClosingBalance.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleCloseCashier} className="w-full" variant="destructive">Confirmar Fechamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- POS Component ---
function POS({ products, user, customers, activeSession, setActiveTab, sales }: { products: Product[], user: FirebaseUser, customers: Customer[], activeSession?: CashierSession, setActiveTab: (t: string) => void, sales: Sale[] }) {
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string>('');
  const [payments, setPayments] = useState<SalePayment[]>([
    { method: 'cash', amount: 0 }
  ]);

  const cartTotal = cart.reduce((acc, item) => acc + item.total, 0);

  // Auto-adjust first payment amount when cart changes
  useEffect(() => {
    if (payments.length === 1) {
      setPayments([{ ...payments[0], amount: cartTotal }]);
    }
  }, [cartTotal]);

  const addPayment = () => {
    const remaining = cartTotal - payments.reduce((acc, p) => acc + p.amount, 0);
    setPayments([...payments, { method: 'credit_card', amount: Math.max(0, remaining) }]);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const updatePayment = (index: number, updates: Partial<SalePayment>) => {
    setPayments(payments.map((p, i) => i === index ? { ...p, ...updates } : p));
  };

  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const isPaidInFull = totalPaid >= cartTotal - 0.01;
  const totalChange = payments.reduce((acc, p) => acc + (p.change || 0), 0);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.error('Produto sem estoque!');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error('Estoque insuficiente!');
          return prev;
        }
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
            : item
        );
      }
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        quantity: 1, 
        price: product.price, 
        total: product.price 
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const product = products.find(p => p.id === productId);
        const newQty = Math.max(1, item.quantity + delta);
        if (product && newQty > product.stock) {
          toast.error('Estoque insuficiente!');
          return item;
        }
        return { ...item, quantity: newQty, total: newQty * item.price };
      }
      return item;
    }));
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || !isPaidInFull) return;
    if (!activeSession) {
      toast.error('O caixa deve estar aberto para realizar vendas!');
      return;
    }

    try {
      const batch = writeBatch(db);
      
      const saleData = {
        items: cart,
        total: cartTotal,
        payments: payments.map(p => ({
          ...p,
          received: p.received || p.amount,
          change: p.change || 0
        })),
        customerId: selectedCustomerId || null,
        createdAt: new Date().toISOString(),
        userId: user.uid
      };

      // Add Sale
      const saleRef = doc(collection(db, 'sales'));
      batch.set(saleRef, saleData);
      setLastSaleId(saleRef.id);

      // Update Stock
      cart.forEach(item => {
        const productRef = doc(db, 'products', item.productId);
        batch.update(productRef, { stock: increment(-item.quantity) });
      });

      // Update Session Expected Balance
      const sessionRef = doc(db, 'cashier_sessions', activeSession.id);
      batch.update(sessionRef, { expectedClosingBalance: increment(cartTotal) });

      // Add Cash Transactions
      payments.forEach((payment) => {
        if (payment.amount <= 0) return;
        const transactionRef = doc(collection(db, 'transactions'));
        
        // Adjust amount for transaction if there was change (only for cash)
        const actualAmount = payment.method === 'cash' 
          ? payment.amount 
          : payment.amount;

        batch.set(transactionRef, {
          type: 'in',
          amount: actualAmount,
          description: `Venda #${saleRef.id.slice(-4)}`,
          category: 'sale',
          date: new Date().toISOString(),
          userId: user.uid
        });
      });

      await batch.commit();
      
      // Auto-issue simulated invoice?
      toast.success('Venda finalizada!');
      setCart([]);
      setPayments([{ method: 'cash', amount: 0 }]);
      setSelectedCustomerId('');
      setShowInvoiceModal(true);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao finalizar venda.');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="grid h-[calc(100vh-120px)] gap-6 md:grid-cols-12"
    >
      {/* Products Selection */}
      <div className="flex flex-col space-y-4 md:col-span-7 lg:col-span-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input 
            placeholder="Buscar produto por nome ou SKU..." 
            className="pl-10" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <ScrollArea className="flex-1 rounded-xl border bg-white p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className="group relative flex flex-col overflow-hidden rounded-xl border bg-white text-left transition-all hover:border-zinc-900 hover:shadow-md disabled:opacity-50"
              >
                <div className="flex aspect-square items-center justify-center bg-zinc-50 p-4 text-zinc-400 group-hover:bg-zinc-100">
                  <Package className="h-12 w-12" />
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">{product.name}</p>
                  <p className="text-xs text-zinc-500">SKU: {product.sku}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-bold">R$ {product.price.toFixed(2)}</span>
                    <Badge variant={product.stock > 5 ? 'secondary' : 'destructive'} className="text-[10px]">
                      {product.stock} un
                    </Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Cart / Checkout */}
      <Card className="flex flex-col md:col-span-5 lg:col-span-4 relative overflow-hidden">
        {!activeSession && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm p-6 text-center">
            <Store className="h-12 w-12 text-red-500 mb-2" />
            <h3 className="font-bold text-lg">Caixa Fechado</h3>
            <p className="text-sm text-zinc-500 mb-4">Abra o caixa no menu lateral para começar a vender.</p>
            <Button variant="outline" size="sm" onClick={() => setActiveTab('cashier')}>Ir para Gestão de Caixa</Button>
          </div>
        )}
        <CardHeader className="pb-3 border-b bg-zinc-50/50">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" /> Carrinho
              </CardTitle>
              <Badge variant="outline">{cart.length} itens</Badge>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-zinc-400 uppercase font-black">Cliente</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Consumidor Final" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">C. Final (Não identificado)</SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-6">
            <div className="space-y-4 py-4">
              {cart.map((item) => (
                <div key={item.productId} className="flex items-center gap-3">
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-zinc-500">R$ {item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.productId, -1)}>
                      -
                    </Button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.productId, 1)}>
                      +
                    </Button>
                  </div>
                  <div className="w-20 text-right text-sm font-bold">
                    R$ {item.total.toFixed(2)}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeFromCart(item.productId)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                  <ShoppingCart className="mb-2 h-12 w-12 opacity-20" />
                  <p>Carrinho vazio</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 border-t bg-zinc-50 p-6">
          <div className="w-full space-y-2">
            <div className="flex justify-between text-sm text-zinc-500">
              <span>Subtotal</span>
              <span>R$ {cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total a Pagar</span>
              <span>R$ {cartTotal.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="w-full space-y-4">
            <div className="flex items-center justify-between">
              <Label>Pagamentos</Label>
              <Button variant="outline" size="xs" onClick={addPayment} className="h-7">
                + Adicionar Formas
              </Button>
            </div>
            
            <div className="space-y-4">
              {payments.map((payment, idx) => (
                <div key={idx} className="space-y-3 rounded-lg border bg-white p-3">
                  <div className="flex items-center gap-2">
                    <Select 
                      value={payment.method} 
                      onValueChange={(v: PaymentMethod) => updatePayment(idx, { method: v })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="relative w-32">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">R$</span>
                      <Input 
                        type="number"
                        className="h-8 pl-7 pr-1"
                        value={payment.amount}
                        onChange={(e) => updatePayment(idx, { amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    
                    {payments.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removePayment(idx)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {payment.method === 'cash' && (
                    <div className="mt-2 space-y-2 rounded-md bg-zinc-50 p-2">
                      <div className="flex items-center justify-between gap-4">
                        <Label className="text-xs">Valor Recebido</Label>
                        <div className="relative w-32">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">R$</span>
                          <Input 
                            type="number"
                            className="h-7 pl-7 pr-1 text-xs"
                            value={payment.received || ''}
                            placeholder={payment.amount.toString()}
                            onChange={(e) => {
                              const received = parseFloat(e.target.value) || 0;
                              updatePayment(idx, { 
                                received, 
                                change: Math.max(0, received - payment.amount) 
                              });
                            }}
                          />
                        </div>
                      </div>
                      {payment.received && payment.received > payment.amount && (
                        <div className="flex justify-between text-xs font-bold text-green-600">
                          <span>Troco</span>
                          <span>R$ {(payment.received - payment.amount).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between text-sm py-2 border-t mt-2">
              <span className={totalPaid >= cartTotal ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                Pago: R$ {totalPaid.toFixed(2)}
              </span>
              <div className="text-right">
                {totalPaid < cartTotal ? (
                  <span className="text-red-500 font-bold">Falta: R$ {(cartTotal - totalPaid).toFixed(2)}</span>
                ) : totalChange > 0 ? (
                  <span className="text-green-600 font-bold animate-pulse">Troco Total: R$ {totalChange.toFixed(2)}</span>
                ) : (
                  <span className="text-zinc-500 font-medium">Valor Exato</span>
                )}
              </div>
            </div>
          </div>

          <Button 
            className="w-full gap-2 py-6 text-lg" 
            disabled={cart.length === 0 || !isPaidInFull}
            onClick={handleCheckout}
          >
            Finalizar Venda
          </Button>
        </CardFooter>
      </Card>

      <InvoiceModal 
        open={showInvoiceModal} 
        onOpenChange={setShowInvoiceModal} 
        saleId={lastSaleId} 
        user={user} 
        customers={customers}
        sales={sales}
      />
    </motion.div>
  );
}

// --- Invoice Modal (Simulated NF-e) ---
function InvoiceModal({ open, onOpenChange, saleId, user, customers, sales }: { open: boolean, onOpenChange: (o: boolean) => void, saleId: string, user: FirebaseUser, customers: Customer[], sales: Sale[] }) {
  const sale = sales.find(s => s.id === saleId);
  const customer = sale?.customerId ? customers.find(c => c.id === sale.customerId) : null;
  const accessKey = useMemo(() => Array.from({ length: 44 }, () => Math.floor(Math.random() * 10)).join(''), [saleId]);
  
  const handlePrint = () => {
    window.print();
  };

  if (!sale) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Emissão de Cupom Fiscal (Simulado)
          </DialogTitle>
          <DialogDescription>A NF-e foi gerada com sucesso para esta transação.</DialogDescription>
        </DialogHeader>
        
        <div id="invoice-print" className="border p-6 font-mono text-sm shadow-inner bg-white max-h-[60vh] overflow-auto">
          <div className="text-center border-b pb-4 mb-4">
            <p className="font-bold text-lg">{user.displayName || 'Empresa Teste LTDA'}</p>
            <p>CNPJ: 00.000.000/0001-00</p>
            <p>Rua Exemplo, 123 - Centro - São Paulo/SP</p>
          </div>
          
          <div className="border-b pb-2 mb-2 text-xs">
            <p className="font-bold">DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</p>
            <div className="grid grid-cols-2 mt-2">
              <div># | CÓD | DESC | QTD | UN | VL UNIT | VL TOT</div>
            </div>
          </div>
          
          <div className="space-y-1 mb-4">
            {sale.items.map((item, i) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span className="truncate flex-1">{String(i+1).padStart(3, '0')} {item.name}</span>
                <span className="w-24 text-right">{item.quantity} x {item.price.toFixed(2)} = {item.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
          
          <div className="border-t pt-2 space-y-1 text-xs">
            <div className="flex justify-between font-bold">
              <span>QTD. TOTAL DE ITENS</span>
              <span>{sale.items.length}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>VALOR TOTAL R$</span>
              <span>{sale.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>FORMA DE PAGAMENTO</span>
              <span>VALOR PAGO R$</span>
            </div>
            {sale.payments.map((p, i) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span>{PAYMENT_METHODS.find(m => m.id === p.method)?.label}</span>
                <span>{p.amount.toFixed(2)}</span>
              </div>
            ))}
            {sale.payments.some(p => p.change && p.change > 0) && (
              <div className="flex justify-between text-zinc-500 font-bold">
                <span>TROCO R$</span>
                <span>{sale.payments.reduce((acc, p) => acc + (p.change || 0), 0).toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="mt-6 border-t pt-4 text-[10px] space-y-1 text-center">
            <p>Consumidor: {customer ? `${customer.name} - CPF: ${customer.cpf || '***.***.***-**'}` : 'NÃO IDENTIFICADO'}</p>
            <p className="font-bold">NFC-e nº 000000{Math.floor(Math.random() * 1000)} Série 001</p>
            <p>Emissão: {format(new Date(sale.createdAt), 'dd/MM/yyyy HH:mm:ss')}</p>
            <p className="break-all text-zinc-400">CHAVE DE ACESSO: {accessKey}</p>
            <div className="mx-auto mt-4 h-24 w-24 bg-zinc-100 flex items-center justify-center border border-dashed rounded">
              <span className="text-[8px] text-zinc-400">QR CODE SIMULADO</span>
            </div>
            <p className="mt-4 italic">PDV Master - Simulação NF-e</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button onClick={() => onOpenChange(false)}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Inventory Component ---
function Inventory({ products, user }: { products: Product[], user: FirebaseUser }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    costPrice: '',
    stock: '',
    category: '',
    sku: '',
    margin: ''
  });

  const calculatePrice = (cost: string, margin: string) => {
    const c = parseFloat(cost);
    const m = parseFloat(margin);
    if (!isNaN(c) && !isNaN(m)) {
      return (c * (1 + m / 100)).toFixed(2);
    }
    return '';
  };

  const calculateMargin = (cost: string, price: string) => {
    const c = parseFloat(cost);
    const p = parseFloat(price);
    if (!isNaN(c) && !isNaN(p) && c > 0) {
      return (((p - c) / c) * 100).toFixed(2);
    }
    return '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        name: formData.name,
        price: parseFloat(formData.price) || 0,
        costPrice: parseFloat(formData.costPrice || '0') || 0,
        stock: parseInt(formData.stock) || 0,
        category: formData.category,
        sku: formData.sku,
        createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString()
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), data);
        toast.success('Produto atualizado!');
      } else {
        await addDoc(collection(db, 'products'), data);
        toast.success('Produto adicionado!');
      }
      setIsAddOpen(false);
      setEditingProduct(null);
      setFormData({ name: '', price: '', costPrice: '', stock: '', category: '', sku: '', margin: '' });
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar produto.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      toast.success('Produto excluído.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir produto.');
    }
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    const margin = calculateMargin(product.costPrice?.toString() || '0', product.price.toString());
    setFormData({
      name: product.name,
      price: product.price.toString(),
      costPrice: product.costPrice?.toString() || '',
      stock: product.stock.toString(),
      category: product.category,
      sku: product.sku,
      margin: margin
    });
    setIsAddOpen(true);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Estoque</h2>
        <Dialog open={isAddOpen} onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) {
            setEditingProduct(null);
            setFormData({ name: '', price: '', costPrice: '', stock: '', category: '', sku: '', margin: '' });
          }
        }}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus className="h-4 w-4" />
            Novo Produto
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
              <DialogDescription>Preencha os detalhes do produto abaixo.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="sku">SKU / Código</Label>
                  <Input id="sku" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Input id="category" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="costPrice">Preço Custo (R$)</Label>
                  <Input 
                    id="costPrice" 
                    type="number" 
                    step="0.01" 
                    value={formData.costPrice} 
                    onChange={e => {
                      const newCost = e.target.value;
                      const newPrice = calculatePrice(newCost, formData.margin);
                      setFormData({...formData, costPrice: newCost, price: newPrice !== '' ? newPrice : formData.price});
                    }} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="margin">Margem Lucro (%)</Label>
                  <Input 
                    id="margin" 
                    type="number" 
                    step="0.01" 
                    value={formData.margin} 
                    onChange={e => {
                      const newMargin = e.target.value;
                      const newPrice = calculatePrice(formData.costPrice, newMargin);
                      setFormData({...formData, margin: newMargin, price: newPrice !== '' ? newPrice : formData.price});
                    }}
                    placeholder="Ex: 30"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="price">Preço Venda (R$)</Label>
                  <Input 
                    id="price" 
                    type="number" 
                    step="0.01" 
                    value={formData.price} 
                    onChange={e => {
                      const newPrice = e.target.value;
                      const newMargin = calculateMargin(formData.costPrice, newPrice);
                      setFormData({...formData, price: newPrice, margin: newMargin !== '' ? newMargin : formData.margin});
                    }} 
                    required 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="stock">Estoque Atual</Label>
                  <Input id="stock" type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} required />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full">Salvar Produto</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>{product.sku}</TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell>
                  <Badge variant={product.stock > 5 ? 'secondary' : 'destructive'}>
                    {product.stock} un
                  </Badge>
                </TableCell>
                <TableCell>R$ {product.price.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(product.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-zinc-500">
                  Nenhum produto cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </motion.div>
  );
}

// --- CashFlow Component ---
function CashFlow({ transactions, user }: { transactions: CashTransaction[], user: FirebaseUser }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: 'out',
    amount: '',
    description: '',
    category: 'expense'
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'transactions'), {
        ...formData,
        amount: parseFloat(formData.amount),
        date: new Date().toISOString(),
        userId: user.uid
      });
      setIsAddOpen(false);
      setFormData({ type: 'out', amount: '', description: '', category: 'expense' });
      toast.success('Transação registrada!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao registrar transação.');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Fluxo de Caixa</h2>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus className="h-4 w-4" />
            Nova Movimentação
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Movimentação</DialogTitle>
              <DialogDescription>Registre uma entrada ou saída manual no caixa.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Entrada (+)</SelectItem>
                    <SelectItem value="out">Saída (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">Valor</Label>
                <Input id="amount" type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="desc">Descrição</Label>
                <Input id="desc" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required />
              </div>
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select value={formData.category} onValueChange={(v: any) => setFormData({...formData, category: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_CATEGORIES.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full">Registrar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        <Card className="md:col-span-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs text-zinc-500">{format(new Date(t.date), 'dd/MM HH:mm')}</TableCell>
                  <TableCell className="font-medium">{t.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{TRANSACTION_CATEGORIES.find(c => c.id === t.category)?.label || t.category}</Badge>
                  </TableCell>
                  <TableCell className={`text-right font-bold ${t.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'in' ? '+' : '-'} R$ {t.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-zinc-500">
                    Nenhuma movimentação registrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <div className="space-y-4 md:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Resumo do Período</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-zinc-500">Entradas</span>
                <span className="font-bold text-green-600">R$ {transactions.filter(t => t.type === 'in').reduce((acc, t) => acc + t.amount, 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-zinc-500">Saídas</span>
                <span className="font-bold text-red-600">R$ {transactions.filter(t => t.type === 'out').reduce((acc, t) => acc + t.amount, 0).toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Saldo</span>
                <span>R$ {(transactions.filter(t => t.type === 'in').reduce((acc, t) => acc + t.amount, 0) - transactions.filter(t => t.type === 'out').reduce((acc, t) => acc + t.amount, 0)).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

// --- Reports Component ---
function Reports({ sales, transactions }: { sales: Sale[], transactions: CashTransaction[] }) {
  const paymentMethodData = useMemo(() => {
    const data: Record<string, number> = {};
    sales.forEach(s => {
      if (s.payments && Array.isArray(s.payments)) {
        s.payments.forEach(p => {
          data[p.method] = (data[p.method] || 0) + p.amount;
        });
      } else if ((s as any).paymentMethod) {
        // Fallback for old sales data structure
        const method = (s as any).paymentMethod;
        data[method] = (data[method] || 0) + s.total;
      }
    });
    return Object.entries(data).map(([name, value]) => ({ 
      name: PAYMENT_METHODS.find(m => m.id === name)?.label || name, 
      value 
    }));
  }, [sales]);

  const COLORS = ['#18181b', '#3f3f46', '#71717a', '#a1a1aa'];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <h2 className="text-3xl font-bold tracking-tight">Relatórios Detalhados</h2>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Forma de Pagamento</CardTitle>
            <CardDescription>Distribuição do volume financeiro por método.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {paymentMethodData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2 text-xs">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-zinc-500">{entry.name}:</span>
                  <span className="font-bold">R$ {entry.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Desempenho de Vendas</CardTitle>
            <CardDescription>Volume de vendas diário.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentMethodData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip cursor={{ fill: '#f4f4f5' }} formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                <Bar dataKey="value" fill="#18181b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
