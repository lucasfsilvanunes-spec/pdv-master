import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../../components/ui/button';

export function InstallPWA() {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setSupportsPWA(true);
      setPromptInstall(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const onClick = (evt: any) => {
    evt.preventDefault();
    if (!promptInstall) {
      return;
    }
    promptInstall.prompt();
  };

  if (!supportsPWA) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full justify-start gap-2 rounded-xl text-xs font-bold border-indigo-200 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 transition-all mb-2"
      onClick={onClick}
    >
      <Download className="h-4 w-4" />
      Baixar Aplicativo
    </Button>
  );
}
