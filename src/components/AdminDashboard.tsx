import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  updateDoc, 
  doc,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Feedback } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  Edit2, 
  ShieldCheck, 
  ShieldAlert,
  Calendar,
  MessageSquare,
  X,
  UserCheck,
  UserX,
  MessageCircle,
  CreditCard,
  Clock,
  AlertCircle,
  Bug,
  Lightbulb,
  HelpCircle,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../../components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function AdminDashboard() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'awaiting' | 'expired'>('all');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states for editing
  const [editValidity, setEditValidity] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editNotes, setEditNotes] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetchedUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Erro ao carregar usuários. Verifique as permissões de admin.");
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedbacks = async () => {
    try {
      setLoadingFeedbacks(true);
      const q = query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetchedFeedbacks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Feedback[];
      setFeedbacks(fetchedFeedbacks);
    } catch (error) {
      console.error("Error fetching feedbacks:", error);
      toast.error("Erro ao carregar feedbacks.");
    } finally {
      setLoadingFeedbacks(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchFeedbacks();
  }, []);

  const handleUpdateFeedbackStatus = async (feedbackId: string, status: 'read' | 'resolved') => {
    try {
      const docRef = doc(db, 'feedbacks', feedbackId);
      await updateDoc(docRef, { status });
      toast.success("Status do feedback atualizado!");
      fetchFeedbacks();
    } catch (error) {
      console.error("Error updating feedback:", error);
      toast.error("Erro ao atualizar feedback.");
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!confirm("Tem certeza que deseja excluir este feedback?")) return;
    try {
      await deleteDoc(doc(db, 'feedbacks', feedbackId));
      toast.success("Feedback excluído!");
      fetchFeedbacks();
    } catch (error) {
      console.error("Error deleting feedback:", error);
      toast.error("Erro ao excluir feedback.");
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      if (activeFilter === 'awaiting') return u.statusPagamento === 'aguardando';
      if (activeFilter === 'expired') return new Date() > new Date(u.validityDate);
      
      return true;
    });
  }, [users, searchTerm, activeFilter]);

  const handleEditClick = (user: UserProfile) => {
    setEditingUser(user);
    setEditValidity(user.validityDate.split('T')[0]); // YYYY-MM-DD for input type="date"
    setEditIsActive(user.isActive);
    setEditNotes(user.supportNotes || '');
    setIsModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingUser) return;

    try {
      const userRef = doc(db, 'users', editingUser.id);
      
      // Preserve original time if only date changed, or just set to end of day
      const newValidity = new Date(editValidity);
      newValidity.setHours(23, 59, 59, 999);

      await updateDoc(userRef, {
        validityDate: newValidity.toISOString(),
        isActive: editIsActive,
        supportNotes: editNotes
      });

      toast.success("Usuário atualizado com sucesso!");
      setIsModalOpen(false);
      fetchUsers(); // Refresh list
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Erro ao atualizar usuário.");
    }
  };

  const handleQuickActivate = async () => {
    if (!editingUser) return;
    
    try {
      const userRef = doc(db, 'users', editingUser.id);
      let daysToAdd = 30;
      const plano = editingUser.planoEscolhido || '';
      
      if (plano.includes('Semestral')) daysToAdd = 180;
      else if (plano.includes('Anual')) daysToAdd = 365;

      const newValidity = addDays(new Date(), daysToAdd);
      newValidity.setHours(23, 59, 59, 999);

      await updateDoc(userRef, {
        validityDate: newValidity.toISOString(),
        isActive: true,
        statusPagamento: 'pago',
        supportNotes: (editNotes ? editNotes + "\n" : "") + `[ATIVAÇÃO RÁPIDA] Plano: ${plano || 'N/A'} em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
      });

      toast.success("Pagamento confirmado e licença ativada!");
      setIsModalOpen(false);
      fetchUsers();
    } catch (error) {
      console.error("Error activating user:", error);
      toast.error("Erro ao ativar licença.");
    }
  };

  const openUserWhatsApp = (user: UserProfile) => {
    const message = encodeURIComponent(`Olá ${user.company_name || user.name}, vi que você demonstrou interesse no plano ${user.planoEscolhido || 'PDV Master'}. Vamos fechar a ativação via Pix?`);
    const phone = user.whatsapp?.replace(/\D/g, '') || '';
    if (!phone) {
      toast.error("WhatsApp não cadastrado para este usuário.");
      return;
    }
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-3 text-zinc-900">
            <ShieldCheck className="h-8 w-8 text-indigo-600" />
            Área do Desenvolvedor
          </h2>
          <p className="text-zinc-500">Gerenciamento administrativo de usuários, licenças e feedbacks.</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="bg-zinc-100 p-1 rounded-xl mb-6">
          <TabsTrigger value="users" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Users className="h-4 w-4 mr-2" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="feedbacks" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <MessageSquare className="h-4 w-4 mr-2" />
            Feedbacks
            {feedbacks.filter(f => f.status === 'new').length > 0 && (
              <span className="ml-2 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 justify-end items-center mb-4">
            <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
              <button 
                onClick={() => setActiveFilter('all')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeFilter === 'all' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setActiveFilter('awaiting')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeFilter === 'awaiting' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Aguardando
              </button>
              <button 
                onClick={() => setActiveFilter('expired')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeFilter === 'expired' ? 'bg-white text-rose-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Vencidos
              </button>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input 
                placeholder="Buscar..." 
                className="pl-10 h-11 bg-white border-zinc-200 rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <Card className="border-zinc-200 shadow-sm overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-zinc-50/50">
                <TableRow>
                  <TableHead className="w-[300px]">Empresa / Usuário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Ramo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex items-center justify-center gap-2 text-zinc-500">
                        <motion.div 
                          animate={{ rotate: 360 }} 
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        >
                          <Users className="h-5 w-5" />
                        </motion.div>
                        Carregando usuários...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-zinc-500">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => {
                    const isExpired = new Date() > new Date(u.validityDate);
                    return (
                      <TableRow key={u.id} className="hover:bg-zinc-50/50 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => openUserWhatsApp(u)}
                              className="h-9 w-9 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                              title="Falar no WhatsApp"
                            >
                              <MessageCircle className="h-5 w-5" />
                            </button>
                            <div className="flex flex-col">
                              <span className="font-bold text-zinc-900">
                                {u.company_name || "Empresa não informada"}
                              </span>
                              <span className="text-xs text-zinc-500">{u.email}</span>
                              {u.full_name && <span className="text-[10px] text-zinc-400 italic">{u.full_name}</span>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <div className={`h-2.5 w-2.5 rounded-full ${u.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                              <Badge variant={u.isActive ? "secondary" : "destructive"} className="text-[10px] uppercase font-bold px-2">
                                {u.isActive ? "Ativo" : "Inativo"}
                              </Badge>
                            </div>
                            {u.statusPagamento === 'aguardando' && (
                              <div className="flex items-center gap-1 text-indigo-600">
                                <Clock className="h-3 w-3" />
                                <span className="text-[10px] font-bold uppercase italic">Aguardando Pix</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className={`text-sm font-medium ${isExpired ? 'text-rose-600' : 'text-zinc-700'}`}>
                              {format(new Date(u.validityDate), 'dd/MM/yyyy')}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {isExpired ? "Vencido" : "Acesso Ok"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-zinc-600">{u.business_industry || "---"}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => handleEditClick(u)}
                          >
                            <Edit2 className="h-4 w-4 text-indigo-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="feedbacks" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loadingFeedbacks ? (
              <div className="col-span-full h-48 flex items-center justify-center text-zinc-500">
                <motion.div 
                  animate={{ rotate: 360 }} 
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="mr-2"
                >
                  <MessageSquare className="h-5 w-5" />
                </motion.div>
                Carregando feedbacks...
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="col-span-full h-48 flex items-center justify-center text-zinc-500">
                Nenhum feedback recebido.
              </div>
            ) : (
              feedbacks.map((f) => (
                <Card key={f.id} className={`border-zinc-200 overflow-hidden ${f.status === 'new' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}>
                  <CardHeader className="bg-zinc-50/50 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {f.type === 'bug' ? <Bug className="h-4 w-4 text-rose-500" /> : 
                         f.type === 'suggestion' ? <Lightbulb className="h-4 w-4 text-amber-500" /> : 
                         <HelpCircle className="h-4 w-4 text-indigo-500" />}
                        <Badge variant="outline" className="text-[10px] uppercase">{f.type}</Badge>
                      </div>
                      <Badge variant={f.status === 'resolved' ? 'secondary' : 'outline'} className="text-[10px] uppercase">
                        {f.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm font-bold mt-2 truncate">{f.companyName}</CardTitle>
                    <CardDescription className="text-[10px]">{f.userEmail}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <p className="text-sm text-zinc-700 leading-relaxed min-h-[60px]">
                      {f.message}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                      <span className="text-[10px] text-zinc-400">
                        {format(new Date(f.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                      <div className="flex gap-2">
                        {f.status === 'new' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-[10px] font-bold text-indigo-600"
                            onClick={() => handleUpdateFeedbackStatus(f.id, 'read')}
                          >
                            Marcar como Lido
                          </Button>
                        )}
                        {f.status !== 'resolved' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-[10px] font-bold text-emerald-600"
                            onClick={() => handleUpdateFeedbackStatus(f.id, 'resolved')}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Resolvido
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-rose-600"
                          onClick={() => handleDeleteFeedback(f.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>


      {/* Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2rem]">
          <div className="bg-indigo-600 p-8 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">Editar Permissões</DialogTitle>
              <DialogDescription className="text-indigo-100 opacity-90">
                Gerencie a licença de <strong>{editingUser?.company_name || editingUser?.email}</strong>
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-bold text-zinc-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-500" />
                  Data de Validade
                </Label>
                <Input 
                  type="date" 
                  value={editValidity}
                  onChange={(e) => setEditValidity(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold text-zinc-700 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-indigo-500" />
                  Status da Conta
                </Label>
                <div className="flex items-center h-11 px-3 border rounded-xl bg-zinc-50">
                  <button 
                    onClick={() => setEditIsActive(prev => !prev)}
                    className={`flex items-center gap-2 w-full text-sm font-bold transition-colors ${editIsActive ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {editIsActive ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                    {editIsActive ? 'CONTA ATIVA' : 'CONTA BLOQUEADA'}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-bold text-zinc-700 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-indigo-500" />
                Notas de Suporte
              </Label>
              <textarea 
                className="w-full min-h-[120px] rounded-2xl border border-zinc-200 p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none bg-zinc-50"
                placeholder="Histórico de atendimento, motivos de bloqueio, etc..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="p-8 bg-zinc-50 border-t border-zinc-100 flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              {editingUser?.statusPagamento === 'aguardando' && (
                <Button 
                  onClick={handleQuickActivate}
                  className="w-full sm:w-auto rounded-xl h-12 px-6 font-bold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 gap-2"
                >
                  <CreditCard className="h-5 w-5" />
                  Confirmar Pagamento Pix
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl h-12 px-6 font-bold text-zinc-500">
                Cancelar
              </Button>
              <Button onClick={handleUpdate} className="rounded-xl h-12 px-8 font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20">
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
