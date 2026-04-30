import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  User, 
  Building2, 
  MapPin, 
  Phone, 
  FileText, 
  ChevronRight, 
  Store,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { addDays } from 'date-fns';

interface OnboardingProps {
  user: any;
  profile: UserProfile;
  onComplete: (updatedProfile: UserProfile) => void;
}

export function Onboarding({ user, profile, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: profile.name || '',
    whatsapp: '',
    cpf: '',
    company_name: '',
    cnpj: '',
    business_industry: ''
  });

  const handleNext = () => {
    if (step === 1) {
      if (!formData.full_name || !formData.whatsapp || !formData.cpf) {
        toast.error('Por favor, preencha todos os campos obrigatórios.');
        return;
      }
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!formData.company_name || !formData.business_industry) {
      toast.error('Por favor, preencha o nome da empresa e o ramo de atividade.');
      return;
    }

    setIsLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const validityDate = addDays(new Date(), 30).toISOString();
      
      const updateData = {
        ...formData,
        trialUsed: true,
        isActive: true, // Activate trial
        validityDate,
        role: profile.role || 'user'
      };

      await updateDoc(userRef, updateData);
      
      onComplete({
        ...profile,
        ...updateData
      });
      
      toast.success('Cadastro finalizado com sucesso! Aproveite seus 30 dias de teste.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar os dados. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-50 p-4 md:p-8 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden"
      >
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-zinc-100 flex">
          <motion.div 
            initial={{ width: '0%' }}
            animate={{ width: step === 1 ? '50%' : '100%' }}
            className="h-full bg-zinc-900"
          />
        </div>

        <div className="p-8 md:p-12">
          {step === 1 ? (
            <motion.div 
              key="step1"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white">
                  <User className="h-6 w-6" />
                </div>
                <h2 className="text-3xl font-black tracking-tight text-zinc-900">Seja bem-vindo!</h2>
                <p className="text-zinc-500">Vamos começar com seus dados básicos para configurar sua conta.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                    <Input 
                      id="full_name"
                      placeholder="Ex: João Silva" 
                      className="pl-10 h-10 rounded-xl"
                      value={formData.full_name}
                      onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                      <Input 
                        id="whatsapp"
                        placeholder="(00) 00000-0000" 
                        className="pl-10 h-10 rounded-xl"
                        value={formData.whatsapp}
                        onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                      <Input 
                        id="cpf"
                        placeholder="000.000.000-00" 
                        className="pl-10 h-10 rounded-xl"
                        value={formData.cpf}
                        onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Button onClick={handleNext} size="lg" className="w-full gap-2 rounded-2xl py-6 h-auto text-lg">
                Próximo passo <ChevronRight className="h-5 w-5" />
              </Button>
            </motion.div>
          ) : (
            <motion.div 
              key="step2"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white">
                  <Building2 className="h-6 w-6" />
                </div>
                <h2 className="text-3xl font-black tracking-tight text-zinc-900">Sua Empresa</h2>
                <p className="text-zinc-500">Agora, conte-nos um pouco sobre o seu negócio.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Nome da Empresa</Label>
                  <div className="relative">
                    <Store className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                    <Input 
                      id="company_name"
                      placeholder="Razão Social ou Nome Fantasia" 
                      className="pl-10 h-10 rounded-xl"
                      value={formData.company_name}
                      onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ (Opcional)</Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                      <Input 
                        id="cnpj"
                        placeholder="00.000.000/0000-00" 
                        className="pl-10 h-10 rounded-xl"
                        value={formData.cnpj}
                        onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business_industry">Ramo de Atividade</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                      <Input 
                        id="business_industry"
                        placeholder="Ex: Restaurante, Loja, etc." 
                        className="pl-10 h-10 rounded-xl"
                        value={formData.business_industry}
                        onChange={(e) => setFormData({...formData, business_industry: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="rounded-2xl h-14 w-20">
                  Voltar
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={isLoading}
                  size="lg" 
                  className="flex-1 gap-2 rounded-2xl py-6 h-auto text-lg"
                >
                  {isLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>Finalizar Cadastro <ArrowRight className="h-5 w-5" /></>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          <div className="mt-8 pt-8 border-t border-zinc-100">
            <div className="flex items-center gap-3 text-zinc-500 text-sm">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-50 text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <p>Ao finalizar, você ganha <strong>30 dias de acesso grátis</strong> para testar todas as funcionalidades.</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
