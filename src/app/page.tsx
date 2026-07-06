import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { Button } from '@/components/ui/moving-border';
import { NeuralBackground } from '@/components/ui/neural-background';
import { CardContainer, CardBody, CardItem } from '@/components/ui/3d-card';

export const metadata: Metadata = {
  title: 'ClearHead | Dump your thoughts in 60 seconds',
  description: 'ClearHead organises your unstructured thoughts into tasks, ideas, worries and reminders — so you don\'t have to. Calm, minimal, and secure.',
};

export default async function LandingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/app/dump');
  }

  return (
    <div className="bg-[#050508] text-white selection:bg-app-primary/30 relative">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <NeuralBackground primaryColor="#7B6EF6" secondaryColor="#2DD4BF" />
      </div>
      
      <main className="min-h-screen flex flex-col items-center justify-center px-6 relative z-10">
        <div className="max-w-2xl text-center space-y-12 relative z-10 pt-20">
          <div className="space-y-6 animate-fade-in-up">
            <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-tight">
              Your brain is full. <br className="hidden sm:block" />
              <span className="text-[#7B6EF6]">Let&apos;s sort it.</span>
            </h1>
            <p className="text-lg sm:text-xl text-app-muted max-w-xl mx-auto leading-relaxed font-medium">
              Dump your thoughts in 60 seconds. ClearHead organises them into tasks, ideas, worries and reminders — so you don&apos;t have to.
            </p>
          </div>
          
          <div className="animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            <Link href="/login" className="inline-block">
              <Button
                borderRadius="1.5rem"
                className="!bg-[linear-gradient(135deg,#7B6EF6_0%,#2DD4BF_100%)] !border-none text-white font-bold text-lg px-8 py-4 transition-all hover:scale-[1.02]"
                containerClassName="h-16 w-64"
                borderClassName="bg-[radial-gradient(circle_at_center,_#7B6EF6_0%,_#2DD4BF_50%,_transparent_100%)] opacity-100"
              >
                Clear my head — it&apos;s free
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <section className="relative w-full min-h-screen overflow-hidden flex flex-col items-center py-24 z-10">
        
        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center space-y-16">
          <h2 className="text-3xl md:text-4xl font-heading font-bold">How it works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <CardContainer className="inter-var">
              <CardBody className="bg-[#13121F] group/card hover:shadow-2xl hover:shadow-app-primary/20 border-white/10 w-full h-auto rounded-xl p-8 border">
                <CardItem translateZ="50" className="text-xl font-bold text-white mb-4 flex items-center justify-center w-full">
                  1. Dump
                </CardItem>
                <CardItem as="p" translateZ="60" className="text-app-muted text-sm text-center">
                  Say or type whatever&apos;s on your mind
                </CardItem>
              </CardBody>
            </CardContainer>

            <CardContainer className="inter-var">
              <CardBody className="bg-[#13121F] group/card hover:shadow-2xl hover:shadow-app-primary/20 border-white/10 w-full h-auto rounded-xl p-8 border">
                <CardItem translateZ="50" className="text-xl font-bold text-white mb-4 flex items-center justify-center w-full">
                  2. Sort
                </CardItem>
                <CardItem as="p" translateZ="60" className="text-app-muted text-sm text-center">
                  AI organizes it into tasks, ideas, worries and reminders
                </CardItem>
              </CardBody>
            </CardContainer>

            <CardContainer className="inter-var">
              <CardBody className="bg-[#13121F] group/card hover:shadow-2xl hover:shadow-app-primary/20 border-white/10 w-full h-auto rounded-xl p-8 border">
                <CardItem translateZ="50" className="text-xl font-bold text-white mb-4 flex items-center justify-center w-full">
                  3. Act
                </CardItem>
                <CardItem as="p" translateZ="60" className="text-app-muted text-sm text-center">
                  Come back to a clear, simple list
                </CardItem>
              </CardBody>
            </CardContainer>
          </div>
        </div>
      </section>
    </div>
  );
}
