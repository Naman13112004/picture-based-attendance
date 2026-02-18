'use client';

import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { Button } from '@/components/ui/button';

export default function InstallAppButton() {
  const { isInstallable, promptInstall } = useInstallPrompt();

  if (!isInstallable) return null;

  return (
    <Button
      onClick={promptInstall}
      className="gap-2 cursor-pointer w-30 mx-auto animate-bounce"
    >
      Install App
    </Button>
  );
}