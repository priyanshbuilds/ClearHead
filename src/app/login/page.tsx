'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { login, signup } from './actions';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { NeuralBackground } from '@/components/ui/neural-background';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { motion } from 'motion/react';

function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const formRef = useRef<HTMLFormElement>(null);
  
  const searchParams = useSearchParams();

  useEffect(() => {
    const err = searchParams?.get('error');
    if (err === 'auth_failed') {
      setError('Authentication failed. Please try again.');
    }
  }, [searchParams]);

  const handleSubmit = async (action: 'login' | 'signup') => {
    if (!formRef.current) return;
    
    setError(null);
    setMessage(null);
    setLoading(true);

    const formData = new FormData(formRef.current);
    const result = action === 'login' ? await login(formData) : await signup(formData);

    if (result && 'error' in result) {
      setError(result.error as string);
    } else if (result && 'message' in result) {
      setMessage(result.message as string);
    }
    
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      setMessage(null);
      
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError('Failed to initiate Google login.');
    }
  };

  return (
    <>
      <div className="space-y-2 text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tighter text-[#F0EFF8]">Welcome back</h1>
        <p className="text-sm text-[#8E8BA8]">Enter your email to sign in to your account</p>
      </div>

      {error && (
        <div className="p-3 text-sm rounded-lg" style={{ background: 'rgba(248,113,113,0.1)', color: '#F87171', border: '1px solid rgba(248,113,113,0.2)' }}>
          {error}
        </div>
      )}
      
      {message && (
        <div className="p-3 text-sm rounded-lg" style={{ background: 'rgba(45,212,191,0.1)', color: '#2DD4BF', border: '1px solid rgba(45,212,191,0.2)' }}>
          {message}
        </div>
      )}

      <div className="space-y-4 relative z-10">
        <button
          type="button"
          onClick={handleGoogleLogin}
          style={{
            background: '#FFFFFF',
            color: '#0F172A',
            border: '1px solid #E2E8F0',
            height: '44px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            fontSize: '14px',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
          className="hover:bg-slate-50 active:scale-[0.98]"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            <path d="M1 1h22v22H1z" fill="none"/>
          </svg>
          Continue with Google
        </button>
      </div>

      <div className="relative flex items-center py-2 z-10">
        <div className="flex-grow border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}></div>
        <span className="flex-shrink-0 mx-4 text-xs font-medium uppercase" style={{ color: '#8E8BA8' }}>
          Or
        </span>
        <div className="flex-grow border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}></div>
      </div>

      <form ref={formRef} className="space-y-4 relative z-10" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: '#C4C2D4' }} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            required
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              color: '#F0EFF8'
            }}
            className="w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B6EF6] focus:border-transparent transition-colors placeholder:text-slate-500"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: '#C4C2D4' }} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              color: '#F0EFF8'
            }}
            className="w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B6EF6] focus:border-transparent transition-colors placeholder:text-slate-500"
          />
        </div>
        
        <div className="flex flex-col space-y-3 pt-2">
          <button
            type="button"
            onClick={() => handleSubmit('login')}
            disabled={loading}
            className="w-full h-11 px-4 text-sm font-bold text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7B6EF6] focus:ring-offset-2 focus:ring-offset-[#080810] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-[0_0_20px_rgba(108,95,230,0.4)] active:scale-[0.98] bg-gradient-to-br from-[#7B6EF6] to-[#2DD4BF]"
          >
            {loading ? 'Processing...' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('signup')}
            disabled={loading}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#F0EFF8'
            }}
            className="w-full h-11 px-4 text-sm font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:bg-[rgba(255,255,255,0.06)] active:scale-[0.98]"
          >
            {loading ? 'Processing...' : 'Sign Up'}
          </button>
        </div>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#050508] relative overflow-hidden text-white selection:bg-app-primary/30">
      
      {/* Ambient Neural Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <NeuralBackground 
          primaryColor="#7B6EF6" 
          secondaryColor="#2DD4BF" 
        />
      </div>

      {/* Spotlight Radial Glow behind the card */}
      <div 
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0"
        style={{
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(123,110,246,0.15) 0%, rgba(123,110,246,0) 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none'
        }}
      />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="relative group/card h-full w-full rounded-2xl" style={{ borderRadius: '16px' }}>
          
          <GlowingEffect
            spread={40}
            glow={true}
            disabled={false}
            proximity={64}
            inactiveZone={0.01}
          />
          
          <div 
            className="relative z-10 w-full h-full p-8 space-y-6"
            style={{
              background: 'rgba(19,18,31,0.85)',
              border: '1px solid rgba(255,255,255,0.07)',
              backdropFilter: 'blur(20px)',
              borderRadius: '16px'
            }}
          >
            <Suspense fallback={<div className="text-center text-sm text-[#8E8BA8]">Loading...</div>}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
