'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { processDump } from '../../actions/processDump';
import { toggleComplete } from '../history/actions';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { motion } from 'motion/react';

type DisplayItem = {
  id: string;
  category: 'TASK' | 'IDEA' | 'WORRY' | 'REMINDER';
  text: string;
  is_completed?: boolean;
};

const AnimatedLoading = () => {
  const messages = [
    "Untangling your thoughts...",
    "Finding the signal in the noise...",
    "Sorting what matters...",
    "Almost there..."
  ];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % messages.length);
    }, 1500);
    return () => clearInterval(timer);
  }, [messages.length]);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0' }}>
      <div 
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '2px solid rgba(123,110,246,0.15)',
          borderTopColor: '#7B6EF6',
        }}
        className="animate-spin"
      />
      <div style={{ position: 'relative', width: '100%', height: '20px', marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
        {messages.map((msg, i) => (
          <span
            key={msg}
            style={{
              position: 'absolute',
              transition: 'opacity 0.5s',
              opacity: i === index ? 1 : 0,
              fontSize: '15px',
              color: '#6B6882',
              fontStyle: 'italic'
            }}
          >
            {msg}
          </span>
        ))}
      </div>
    </div>
  );
};

export default function DumpPage() {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DisplayItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [isFocused, setIsFocused] = useState(false);
  const [isHoveredMic, setIsHoveredMic] = useState(false);
  const [isHoveredSubmit, setIsHoveredSubmit] = useState(false);
  const [isActiveSubmit, setIsActiveSubmit] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });

    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognitionRef.current.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setText(prev => {
          const base = prev.endsWith(' ') || prev === '' ? prev : prev + ' ';
          return base + currentTranscript;
        });
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  const handleSubmit = async () => {
    if (!text.trim() || !userId) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await processDump(text, userId);
      if (response.success && response.items) {
        setResults(response.items.map(item => ({
          ...item,
          id: crypto.randomUUID(),
          is_completed: false
        })));
        setText('');
      } else {
        setError(response.message || 'Failed to process thoughts. Please try again.');
      }
    } catch (e) {
      console.error(e);
      setError('Failed to process thoughts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleComplete = async (id: string, currentStatus: boolean) => {
    setResults(prev => prev.map(i => i.id === id ? { ...i, is_completed: !currentStatus } : i));
    try {
      await toggleComplete(id, !currentStatus);
    } catch {
      setResults(prev => prev.map(i => i.id === id ? { ...i, is_completed: currentStatus } : i));
    }
  };

  const grouped = results.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, DisplayItem[]>);

  const getCategoryStyles = (category: string) => {
    switch (category) {
      case 'TASK': return { 
        headerBg: 'rgba(123,110,246,0.1)', 
        headerBorder: 'rgba(123,110,246,0.15)',
        badgeBg: 'rgba(123,110,246,0.2)',
        badgeColor: '#A89EF8',
        dot: '#7B6EF6'
      };
      case 'IDEA': return { 
        headerBg: 'rgba(167,139,250,0.08)', 
        headerBorder: 'rgba(167,139,250,0.12)',
        badgeBg: 'rgba(167,139,250,0.2)',
        badgeColor: '#C4B5FD',
        dot: '#A78BFA'
      };
      case 'WORRY': return { 
        headerBg: 'rgba(251,191,36,0.08)', 
        headerBorder: 'rgba(251,191,36,0.12)',
        badgeBg: 'rgba(251,191,36,0.2)',
        badgeColor: '#FCD34D',
        dot: '#FBBF24'
      };
      case 'REMINDER': return { 
        headerBg: 'rgba(45,212,191,0.08)', 
        headerBorder: 'rgba(45,212,191,0.12)',
        badgeBg: 'rgba(45,212,191,0.2)',
        badgeColor: '#5EEAD4',
        dot: '#2DD4BF'
      };
      default: return { 
        headerBg: 'rgba(255,255,255,0.05)', 
        headerBorder: 'rgba(255,255,255,0.1)',
        badgeBg: 'rgba(255,255,255,0.1)',
        badgeColor: '#F0EFF8',
        dot: '#F0EFF8'
      };
    }
  };

  const activeCategories = ['TASK', 'IDEA', 'WORRY', 'REMINDER'].filter(cat => grouped[cat]?.length > 0);

  return (
    <div 
      className="max-w-4xl mx-auto min-h-[100dvh] bg-[#050508]/40 backdrop-blur-md border-x border-white/[0.02]"
      style={{ padding: '0 20px', paddingBottom: '100px' }}
    >
      
      {/* Heading Section */}
      <div style={{ paddingTop: '80px', textAlign: 'center', marginBottom: '40px' }}>
        <h1 className="font-heading" style={{
          fontSize: '36px',
          fontWeight: 800,
          color: '#F0EFF8',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          margin: 0
        }}>
          What&apos;s on your mind?
        </h1>
        <p style={{
          fontSize: '15px',
          color: '#6B6882',
          marginTop: '10px',
          fontFamily: 'Inter',
          margin: '10px 0 0 0'
        }}>
          No filters. No judgment. Just let it out.
        </p>
      </div>

      {/* Input Form */}
      <div style={{ 
        maxWidth: '680px', 
        margin: '0 auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px',
        boxShadow: '0 20px 60px rgba(123,110,246,0.08)',
        borderRadius: '16px'
      }}>
        <div style={{ position: 'relative' }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Dump everything — tasks, ideas, worries, anything..."
            style={{
              width: '100%',
              minHeight: '200px',
              background: isFocused ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.04)',
              border: isFocused ? '1px solid rgba(123,110,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '20px',
              color: '#F0EFF8',
              fontSize: '16px',
              lineHeight: 1.7,
              fontFamily: 'Inter',
              resize: 'vertical',
              outline: 'none',
              boxShadow: isFocused ? '0 0 0 3px rgba(123,110,246,0.12), 0 0 40px rgba(123,110,246,0.06)' : 'none',
              transition: 'all 0.25s ease'
            }}
          />
          
          {/* Floating Mic */}
          {recognitionRef.current && (
            <button
              onClick={toggleRecording}
              onMouseEnter={() => setIsHoveredMic(true)}
              onMouseLeave={() => setIsHoveredMic(false)}
              style={{
                position: 'absolute',
                bottom: '20px', // Adjusted for textarea padding + 14px visually
                right: '14px',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: isRecording ? 'rgba(45,212,191,0.15)' : (isHoveredMic ? 'rgba(123,110,246,0.2)' : 'rgba(255,255,255,0.07)'),
                border: isRecording ? 'none' : '1px solid rgba(255,255,255,0.1)',
                color: isRecording ? '#2DD4BF' : (isHoveredMic ? '#A89EF8' : '#6B6882'),
                boxShadow: isRecording ? '0 0 0 4px rgba(45,212,191,0.15)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              className={isRecording ? 'animate-pulse' : ''}
              title="Dictate thoughts"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLoading || !text.trim() || !userId}
          onMouseEnter={() => setIsHoveredSubmit(true)}
          onMouseLeave={() => { setIsHoveredSubmit(false); setIsActiveSubmit(false); }}
          onMouseDown={() => setIsActiveSubmit(true)}
          onMouseUp={() => setIsActiveSubmit(false)}
          className="font-heading"
          style={{
            width: '100%',
            height: '54px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #6C5FE6 0%, #4ECDC4 100%)',
            color: 'white',
            fontSize: '15px',
            fontWeight: 700,
            letterSpacing: '0.01em',
            border: 'none',
            cursor: (isLoading || !text.trim() || !userId) ? 'not-allowed' : 'pointer',
            opacity: (isLoading || !text.trim() || !userId) ? 0.5 : 1,
            boxShadow: (!isLoading && isHoveredSubmit) ? '0 0 30px rgba(108,95,230,0.45), 0 8px 25px rgba(108,95,230,0.3)' : 'none',
            transform: (!isLoading && isActiveSubmit) ? 'translateY(0px)' : ((!isLoading && isHoveredSubmit) ? 'translateY(-1px)' : 'none'),
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          Clear my head
        </button>
      </div>

      {/* Loading State */}
      {isLoading && <AnimatedLoading />}

      {/* Error State */}
      {error && !isLoading && (
        <div style={{ maxWidth: '680px', margin: '28px auto 0', textAlign: 'center' }}>
          <p style={{ color: '#F87171', fontSize: '15px' }}>{error}</p>
        </div>
      )}

      {/* Results Section */}
      {results.length > 0 && !isLoading && !error && (
        <div style={{ maxWidth: '680px', margin: '28px auto 0' }}>
          
          {/* Summary Bar */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {activeCategories.map((cat, i) => {
              const count = grouped[cat].length;
              const styles = getCategoryStyles(cat);
              const label = count === 1 ? cat.toLowerCase() : `${cat.toLowerCase()}s`;
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#6B6882' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: styles.dot }} />
                  {count} {label}
                  {i < activeCategories.length - 1 && <span style={{ marginLeft: '12px' }}>&middot;</span>}
                </div>
              );
            })}
          </div>

          {/* Result Cards Grid */}
          <div style={{ display: 'grid', gap: '14px' }}>
            {activeCategories.map((category, index) => {
              const items = grouped[category];
              const styles = getCategoryStyles(category);
              
              return (
                <div 
                  key={category}
                  className="relative group/card"
                  style={{
                    borderRadius: '16px',
                    animation: `fadeSlideUp 0.4s ease forwards`,
                    animationDelay: `${index * 0.08}s`,
                    opacity: 0,
                    transform: 'translateY(12px)'
                  }}
                >
                  <GlowingEffect
                    spread={40}
                    glow={true}
                    disabled={false}
                    proximity={64}
                    inactiveZone={0.01}
                  />
                  <div 
                    className="relative z-10 w-full h-full"
                    style={{
                      background: 'rgba(19,18,31,0.8)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: '16px',
                      padding: 0,
                      overflow: 'hidden'
                    }}
                  >
                    {/* Card Header Strip */}
                    <div style={{
                      padding: '12px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: styles.headerBg,
                      borderBottom: `1px solid ${styles.headerBorder}`
                    }}>
                      <div style={{
                        background: styles.badgeBg,
                        color: styles.badgeColor,
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        padding: '3px 10px',
                        borderRadius: '20px'
                      }}>
                        {category}
                      </div>
                    </div>

                    {/* Items List */}
                    <div>
                      {items.map((item, itemIndex) => (
                        <div 
                          key={item.id}
                          style={{
                            padding: '12px 18px',
                            borderBottom: itemIndex === items.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                            fontSize: '14px',
                            color: item.category === 'TASK' && item.is_completed ? '#6B6882' : '#C4C2D4',
                            textDecoration: item.category === 'TASK' && item.is_completed ? 'line-through' : 'none',
                            lineHeight: 1.55,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px'
                          }}
                        >
                          {item.category === 'TASK' && (
                            <button
                              onClick={() => handleToggleComplete(item.id, item.is_completed || false)}
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                border: item.is_completed ? 'none' : '1.5px solid rgba(123,110,246,0.4)',
                                background: item.is_completed ? '#7B6EF6' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0,
                                marginTop: '2px' // align with text
                              }}
                            >
                              {item.is_completed && (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </button>
                          )}
                          <span style={{ flex: 1 }}>{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && results.length === 0 && text.length === 0 && (
        <div style={{ paddingTop: '80px', textAlign: 'center' }}>
          <motion.span 
            animate={{ y: [-6, 6, -6] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{ fontSize: '48px', display: 'inline-block', filter: 'drop-shadow(0 0 12px rgba(123,110,246,0.9)) drop-shadow(0 0 24px rgba(123,110,246,0.4))' }}
          >
            🧠
          </motion.span>
          <h3 className="font-heading" style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#F0EFF8',
            marginTop: '20px',
            margin: '20px 0 0 0'
          }}>
            Your mind is clear.
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#6B6882',
            marginTop: '8px',
            margin: '8px 0 0 0'
          }}>
            Come back when the thoughts pile up.
          </p>
        </div>
      )}
    </div>
  );
}
