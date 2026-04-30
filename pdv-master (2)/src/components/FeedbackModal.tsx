import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { toast } from 'sonner';
import { MessageSquare, Bug, Lightbulb, HelpCircle } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
}

export function FeedbackModal({ isOpen, onClose, user }: FeedbackModalProps) {
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'bug' | 'suggestion' | 'support'>('bug');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error('Por favor, descreva seu problema ou sugestão.');
      return;
    }

    try {
      setIsSubmitting(true);
      await addDoc(collection(db, 'feedbacks'), {
        userId: user.id,
        userEmail: user.email,
        companyName: user.company_name || 'N/A',
        message: message.trim(),
        type,
        status: 'new',
        createdAt: new Date().toISOString()
      });

      toast.success('Feedback enviado! Obrigado pela sua ajuda.');
      setMessage('');
      onClose();
    } catch (error) {
      console.error('Error sending feedback:', error);
      toast.error('Erro ao enviar feedback. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-[2rem] p-0 overflow-hidden">
        <div className="bg-zinc-900 p-6 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-400" />
              Enviar Feedback
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Relate problemas ou dê sugestões para melhorarmos o PDV Master.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-zinc-500 uppercase">Tipo de Feedback</Label>
            <Select value={type} onValueChange={(val: any) => setType(val)}>
              <SelectTrigger className="rounded-xl h-11">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">
                  <div className="flex items-center gap-2">
                    <Bug className="h-4 w-4 text-rose-500" />
                    <span>Problema / Bug</span>
                  </div>
                </SelectItem>
                <SelectItem value="suggestion">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    <span>Sugestão</span>
                  </div>
                </SelectItem>
                <SelectItem value="support">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-indigo-500" />
                    <span>Suporte Geral</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-zinc-500 uppercase">Descrição</Label>
            <textarea
              className="w-full min-h-[120px] rounded-xl border border-zinc-200 p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none bg-zinc-50"
              placeholder="Descreva detalhadamente o ocorrido..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="p-6 bg-zinc-50 border-t border-zinc-100">
          <Button variant="ghost" onClick={onClose} className="rounded-xl">
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="rounded-xl bg-zinc-900 hover:bg-zinc-800 px-8"
          >
            {isSubmitting ? 'Enviando...' : 'Enviar Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
