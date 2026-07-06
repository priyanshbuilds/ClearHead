'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { FloatingDock } from '@/components/ui/floating-dock';
import { Brain, Clock, Settings, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { NeuralBrandBackground } from '@/components/ui/neural-brand-background';

export default function AppLayoutClient({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navLinks = [
    { 
      title: 'Dump', 
      icon: <Brain className="h-full w-full" />, 
      href: '/app/dump' 
    },
    { 
      title: 'History', 
      icon: <Clock className="h-full w-full" />, 
      href: '/app/history' 
    },
    { 
      title: 'Settings', 
      icon: <Settings className="h-full w-full" />, 
      href: '/app/settings' 
    },
  ];

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#050508] text-white selection:bg-app-primary/30 relative">
      
      {/* Ambient Neural Brand Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <NeuralBrandBackground 
          word="CLEARHEAD"
          fillerNodeCount={38}
          connectionDistance={5.5}
          primaryColor="#7B6EF6"
          secondaryColor="#2DD4BF"
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0 md:pl-28 scroll-smooth relative z-10">
        {children}
      </main>

      {/* Floating Navigation Dock */}
      <FloatingDock
        items={navLinks}
        className="fixed left-6 top-1/2 -translate-y-1/2 z-50"
        mobileClassName="fixed bottom-6 right-6 z-50" // put toggle on bottom right for mobile
      />

      {/* Sign Out Button - Desktop */}
      <div className="hidden md:block fixed bottom-6 left-6 z-50">
        <button
          onClick={handleSignOut}
          className="text-app-muted hover:text-white transition-colors flex items-center gap-2 text-sm font-medium bg-[#13121F] border border-white/10 px-4 py-2 rounded-xl"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>

      {/* Sign Out Button - Mobile (Header area) */}
      <div className="md:hidden fixed top-6 right-6 z-50">
         <button
          onClick={handleSignOut}
          className="text-app-muted hover:text-white transition-colors flex items-center justify-center p-2 bg-[#13121F] border border-white/10 rounded-full"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>

      {/* Branding - Mobile & Desktop Header Left */}
      <div className="fixed top-6 left-6 z-40 flex items-center gap-3 bg-[#13121F]/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-lg">
        <motion.span 
          style={{ filter: 'drop-shadow(0 0 12px rgba(123,110,246,0.9)) drop-shadow(0 0 24px rgba(123,110,246,0.4))' }}
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="text-lg"
        >
          🧠
        </motion.span>
        <span className="font-heading font-[800] text-[18px] tracking-wider text-white">
          ClearHead
        </span>
      </div>

    </div>
  );
}
