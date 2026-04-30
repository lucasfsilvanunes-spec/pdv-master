import React from 'react';
import { motion } from 'motion/react';
import { 
  Check, 
  Smartphone, 
  ShieldCheck, 
  CloudUpload, 
  Zap,
  MessageCircle,
  ArrowRight
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

interface PlanProps {
  user: { uid: string };
  onContinue: () => void;
}

const PLANS = [
  {
    id: 'monthly',
    name: 'Plano Mensal',
    price: '59,90',
    period: '/mês',
    features: ['Suporte Prioritário', 'Backup em Nuvem', 'Vendas Ilimitadas'],
    highlight: false,
    url: 'https://invoice.infinitepay.io/plans/lucas-fernando-069/O2fstThPj'
  },
  {
    id: 'semiannual',
    name: 'Plano Semestral',
    price: '299,90',
    period: '/semestre',
    features: ['Suporte Prioritário', 'Backup em Nuvem', 'Vendas Ilimitadas'],
    savings: 'Economize R$ 60',
    highlight: false,
    url: 'https://invoice.infinitepay.io/plans/lucas-fernando-069/wEEnga6N'
  },
  {
    id: 'annual',
    name: 'Plano Anual',
    price: '499,90',
    period: '/ano',
    features: ['Suporte Prioritário', 'Backup em Nuvem', 'Vendas Ilimitadas'],
    monthlyPrice: 'R$ 41,65/mês',
    highlight: true,
    tag: 'MELHOR OFERTA',
    url: 'https://invoice.infinitepay.io/plans/lucas-fernando-069/2aHs6xVfnJ'
  }
];

export function Plans({ user, onContinue }: PlanProps) {
  const handleSelectPlan = async (plan: typeof PLANS[0]) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        planoEscolhido: plan.name,
        statusPagamento: 'aguardando',
        dataSolicitacao: new Date().toISOString()
      });
      
      toast.success('Redirecionando para o pagamento...');
      
      // Redirect to InfinitePay link
      setTimeout(() => {
        window.open(plan.url, '_blank');
      }, 1000);
      
    } catch (error) {
      console.error("Error selecting plan:", error);
      toast.error('Erro ao processar pedido. Tente novamente.');
    }
  };

  const openWhatsApp = () => {
    window.open('https://wa.me/5519997096089?text=Olá, acabei de escolher um plano no app e quero o Pix para ativação!', '_blank');
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 sm:p-12 font-sans">
      <div className="max-w-5xl w-full space-y-12">
        <div className="text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-4 py-1.5 rounded-full font-bold mb-4">
              🚀 Liberação IMEDIATA via Pix
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-black text-zinc-900 tracking-tight">
              Escolha o Plano Ideal para seu Negócio
            </h1>
            <p className="text-zinc-500 text-lg max-w-2xl mx-auto">
              Garanta acesso ilimitado ao PDV Master e leve sua gestão para o próximo nível com suporte exclusivo.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-white rounded-[2.5rem] p-8 shadow-xl border-2 transition-all hover:shadow-2xl hover:-translate-y-1 ${
                plan.highlight ? 'border-indigo-600 ring-4 ring-indigo-50' : 'border-zinc-100'
              }`}
            >
              {plan.tag && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                   <span className="bg-indigo-600 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-lg">
                     {plan.tag}
                   </span>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-zinc-500 uppercase tracking-widest">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-4xl font-black text-zinc-900">R$ {plan.price}</span>
                    <span className="text-zinc-400 font-medium">{plan.period}</span>
                  </div>
                  {plan.monthlyPrice && (
                    <p className="text-emerald-600 font-bold text-sm mt-1">{plan.monthlyPrice}</p>
                  )}
                  {plan.savings && (
                    <p className="text-orange-500 font-bold text-xs mt-1 uppercase tracking-tight">{plan.savings}</p>
                  )}
                </div>

                <div className="space-y-4">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-3">
                      <div className="h-5 w-5 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3 w-3 text-indigo-600 stroke-[3]" />
                      </div>
                      <span className="text-zinc-600 text-sm font-medium">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button 
                  onClick={() => handleSelectPlan(plan)}
                  className={`w-full rounded-2xl py-7 h-auto text-lg font-bold transition-all ${
                    plan.highlight 
                      ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20' 
                      : 'bg-zinc-900 hover:bg-zinc-800'
                  }`}
                >
                  Assinar Agora
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-widest">
            ⚠️ Em caso de atraso será aplicada uma multa de R$ 5,00 + juros de 0,50% ao dia.
          </p>
        </div>

        <div className="flex flex-col items-center gap-8 pt-6">
          <button 
            onClick={openWhatsApp}
            className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-zinc-200 shadow-sm hover:bg-zinc-50 transition-all font-bold text-zinc-600"
          >
            <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
              <MessageCircle className="h-5 w-5" />
            </div>
            Dúvidas? Chame no WhatsApp
          </button>

          <Button 
            variant="ghost" 
            onClick={onContinue}
            className="text-zinc-400 hover:text-zinc-600 font-medium gap-2 text-sm"
          >
            Continuar com Teste Grátis de 30 dias
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Internal Badge for consistency
function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={`inline-flex items-center text-xs font-semibold border ${className}`}>
      {children}
    </span>
  );
}
