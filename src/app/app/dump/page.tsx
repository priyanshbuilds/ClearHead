'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { processDump } from '../../actions/processDump';
import { toggleComplete } from '../history/actions';
import { getNextActions, type NextActionItem } from '../../actions/getNextActions';
import { chunkTask } from '../../actions/chunkTask';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { motion, AnimatePresence } from 'motion/react';

type DisplayItem = {
  id: string;
  category: 'TASK' | 'IDEA' | 'WORRY' | 'REMINDER';
  text: string;
  is_completed?: boolean;
  estimated_minutes?: number;
  children?: { id: string; text: string; is_completed: boolean; estimated_minutes?: number }[];
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
  
  const [nextActions, setNextActions] = useState<NextActionItem[]>([]);
  const [isChunking, setIsChunking] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => setExpandedTasks(prev => ({ ...prev, [id]: !prev[id] }));

  const [isFocused, setIsFocused] = useState(false);
  const [isHoveredMic, setIsHoveredMic] = useState(false);
  const [isHoveredSubmit, setIsHoveredSubmit] = useState(false);
  const [isActiveSubmit, setIsActiveSubmit] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        getNextActions().then(res => {
          console.log('getNextActions result:', res);
          if (res.success && res.data) setNextActions(res.data);
        });
      }
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

  const handleNextActionComplete = async (id: string, currentStatus: boolean) => {
    if (currentStatus) return; // already completed
    
    // 1. Immediately show checked state
    setNextActions(prev => prev.map(i => i.id === id ? { ...i, is_completed: true } : i));
    
    // 2. Short delay so user sees check register
    await new Promise(resolve => setTimeout(resolve, 450));
    
    // 3. Remove from list to trigger exit animation
    setNextActions(prev => prev.filter(i => i.id !== id));
    
    // Persist to DB
    try {
      await toggleComplete(id, true);
    } catch (e) {
      console.error(e);
    }

    // 4. Gracefully re-fetch next best task
    getNextActions().then(res => {
      if (res.success && res.data) setNextActions(res.data);
    });
  };

  const handleChunkTask = async (id: string) => {
    setIsChunking(id);
    try {
      const res = await chunkTask(id);
      if (res.success && res.data) {
        setResults(prev => prev.map(item => {
          if (item.id === id) {
            return { 
              ...item, 
              children: res.data?.map(child => ({
                id: child.id,
                text: child.text,
                is_completed: child.is_completed,
                estimated_minutes: child.estimated_minutes
              }))
            };
          }
          return item;
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsChunking(null);
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

      {/* Right Now Section */}
      {nextActions.length > 0 && (
        <div style={{ maxWidth: '680px', margin: '40px auto 40px auto' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#6B6882', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', marginLeft: '8px' }}>
            Right now
          </h2>
          <div style={{ display: 'grid', gap: '10px' }}>
            <AnimatePresence mode="popLayout">
              {nextActions.map((action) => {
                const rankConfig = {
                  priority: { border: 'rgba(239,68,68,0.2)', bg: 'rgba(239,68,68,0.05)', dot: '#EF4444', label: 'Priority' },
                  easy_win: { border: 'rgba(45,212,191,0.2)', bg: 'rgba(45,212,191,0.05)', dot: '#2DD4BF', label: 'Easy Win' },
                  no_rush: { border: 'rgba(94,234,212,0.15)', bg: 'rgba(94,234,212,0.05)', dot: '#5EEAD4', label: 'No rush' }
                };
                const rankStyles = rankConfig[action.priority_rank as 'priority' | 'easy_win' | 'no_rush'] || rankConfig.no_rush;
                
                return (
                  <motion.div
                    key={action.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: action.is_completed ? 0.6 : 1, y: 0 }}
                    exit={{ x: 100, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      background: rankStyles.bg,
                      border: `1px solid ${rankStyles.border}`,
                      padding: '14px 18px',
                      borderRadius: '14px',
                    }}
                  >
                    <button
                      onClick={() => handleNextActionComplete(action.id, action.is_completed)}
                      style={{
                        width: '18px', height: '18px', borderRadius: '50%',
                        border: action.is_completed ? 'none' : `1.5px solid ${rankStyles.dot}`,
                        background: action.is_completed ? rankStyles.dot : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', flexShrink: 0, marginTop: '2px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {action.is_completed && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </button>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: rankStyles.dot, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {rankStyles.label}
                        </span>
                        {action.estimated_minutes && (
                          <span style={{ fontSize: '11px', color: '#6B6882' }}>~{action.estimated_minutes} min</span>
                        )}
                      </div>
                      <div style={{ 
                        fontSize: '14px', 
                        color: action.is_completed ? '#6B6882' : '#E2E8F0', 
                        textDecoration: action.is_completed ? 'line-through' : 'none', 
                        lineHeight: 1.5,
                        transition: 'color 0.2s ease'
                      }}>
                        {action.text}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

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
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                              <span style={{ flex: 1 }}>{item.text}</span>
                              {item.estimated_minutes && (
                                <span style={{ fontSize: '11px', color: '#6B6882' }}>~{item.estimated_minutes} min</span>
                              )}
                              {item.category === 'TASK' && item.estimated_minutes && item.estimated_minutes >= 20 && !item.children && (
                                <button
                                  onClick={() => handleChunkTask(item.id)}
                                  disabled={isChunking === item.id}
                                  style={{
                                    fontSize: '11px',
                                    color: '#A89EF8',
                                    background: 'rgba(123,110,246,0.1)',
                                    border: '1px solid rgba(123,110,246,0.2)',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    cursor: isChunking === item.id ? 'not-allowed' : 'pointer',
                                    opacity: isChunking === item.id ? 0.5 : 1
                                  }}
                                >
                                  {isChunking === item.id ? 'Breaking down...' : 'Break it down'}
                                </button>
                              )}
                            </div>
                            
                            {/* Render children if they exist */}
                            {item.children && item.children.length > 0 && (
                              <div style={{ marginTop: '8px' }}>
                                <button
                                  onClick={() => toggleExpand(item.id)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    fontSize: '11px', color: '#8E8BA8', background: 'transparent',
                                    border: 'none', cursor: 'pointer', padding: '4px 0'
                                  }}
                                >
                                  {item.text.length > 0 && item.text.split(' ')[0]} ▾ {item.children.length} steps
                                </button>
                                <AnimatePresence initial={false}>
                                  {expandedTasks[item.id] && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                      style={{ overflow: 'hidden' }}
                                    >
                                      <div style={{
                                        marginTop: '12px',
                                        paddingLeft: '16px',
                                        borderLeft: '1px solid rgba(255,255,255,0.08)',
                                        display: 'grid',
                                        gap: '10px',
                                        paddingBottom: '8px'
                                      }}>
                                        {item.children.map(child => (
                                          <div key={child.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                    <button
                                      onClick={() => handleToggleComplete(child.id, child.is_completed || false)}
                                      style={{
                                        width: '14px', height: '14px', borderRadius: '50%',
                                        border: child.is_completed ? 'none' : '1.5px solid rgba(123,110,246,0.4)',
                                        background: child.is_completed ? '#7B6EF6' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', flexShrink: 0, marginTop: '2px'
                                      }}
                                    >
                                      {child.is_completed && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                    </button>
                                    <div style={{ flex: 1, fontSize: '13px', color: child.is_completed ? '#6B6882' : '#C4C2D4', textDecoration: child.is_completed ? 'line-through' : 'none', lineHeight: 1.4 }}>
                                      {child.text}
                                      {child.estimated_minutes && (
                                        <span style={{ fontSize: '11px', color: '#6B6882', marginLeft: '6px' }}>~{child.estimated_minutes} min</span>
                                      )}
                                    </div>
                                  </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </div>
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
