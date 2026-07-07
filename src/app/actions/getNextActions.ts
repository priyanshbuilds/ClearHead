'use server';

import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export type NextActionItem = {
  id: string;
  category: 'TASK';
  text: string;
  is_completed: boolean;
  priority_rank: 'priority' | 'easy_win' | 'no_rush';
  estimated_minutes?: number;
  usedFallback?: boolean;
};

export async function getNextActions(): Promise<{ success: boolean; data?: NextActionItem[]; error?: string; usedFallback?: boolean }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const fourteenDaysAgoStr = fourteenDaysAgo.toISOString();

  const { data, error } = await supabase
    .from('dump_items')
    .select(`
      id,
      category,
      text,
      is_completed,
      priority_rank,
      estimated_minutes,
      created_at,
      dumps!inner(user_id)
    `)
    .eq('dumps.user_id', user.id)
    .eq('category', 'TASK')
    .is('parent_item_id', null)
    .eq('is_completed', false)
    .gte('created_at', fourteenDaysAgoStr)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch tasks for Next Actions:', error);
    return { success: false, error: 'Failed to fetch tasks' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks = (data as any[]).map(item => ({
    id: item.id,
    text: item.text,
    priority_rank: item.priority_rank as 'priority' | 'easy_win' | 'no_rush' | null,
    estimated_minutes: item.estimated_minutes as number | undefined,
    created_at: new Date(item.created_at).getTime(),
  }));

  if (tasks.length === 0) {
    return { success: true, data: [] };
  }

  const alreadyRankedTasks = tasks.filter(t => t.priority_rank !== null);
  const unrankedTasks = tasks.filter(t => t.priority_rank === null);

  const getFullList = (pool: typeof tasks) => {
    // Sort pool by created_at desc (newest first)
    const sortedPool = [...pool].sort((a, b) => b.created_at - a.created_at);
    
    const result: NextActionItem[] = [];
    
    // 1. Priority tasks
    const priorities = sortedPool.filter(t => t.priority_rank === 'priority');
    priorities.forEach(p => {
      result.push({ id: p.id, category: 'TASK', text: p.text, is_completed: false, priority_rank: 'priority', estimated_minutes: p.estimated_minutes });
    });
    
    // 2. Easy win tasks
    const easyWins = sortedPool.filter(t => t.priority_rank === 'easy_win');
    easyWins.forEach(e => {
      result.push({ id: e.id, category: 'TASK', text: e.text, is_completed: false, priority_rank: 'easy_win', estimated_minutes: e.estimated_minutes });
    });
    
    // 3. No rush (everything else)
    const noRush = sortedPool.filter(t => t.priority_rank !== 'priority' && t.priority_rank !== 'easy_win');
    noRush.forEach(t => {
      result.push({ id: t.id, category: 'TASK', text: t.text, is_completed: false, priority_rank: 'no_rush', estimated_minutes: t.estimated_minutes });
    });
    
    return result;
  };

  // If all tasks are already ranked, just return full list
  if (unrankedTasks.length === 0) {
    return { success: true, data: getFullList(alreadyRankedTasks) };
  }

  let newRanks: { id: string, priority_rank: 'priority' | 'easy_win' | 'no_rush' }[] = [];
  let usedFallback = false;

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const tasksToRank = unrankedTasks.slice(0, 50);
  const promptText = `
You are an ADHD-aware task prioritizer. I have a list of incomplete tasks.
Categorize each task exactly as follows:
- "priority": Genuinely urgent/important. Base this on explicit urgency language ("urgent", "asap", "deadline", "today"), approaching dates, or high impact. Can apply to MULTIPLE tasks.
- "easy_win": Quick, low-effort tasks, generally under 10 minutes estimated time. Can apply to MULTIPLE tasks.
- "no_rush": All remaining tasks that are neither urgent nor a quick easy win.

Output ONLY valid JSON in this format:
{
  "actions": [
    { "id": "task-id", "priority_rank": "priority" },
    { "id": "task-id", "priority_rank": "no_rush" }
  ]
}

Tasks:
${JSON.stringify(tasksToRank.map(t => ({ id: t.id, text: t.text, estimated_minutes: t.estimated_minutes })))}
  `;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 1024,
      temperature: 0,
      system: "You are a helpful task prioritizing assistant. Return only valid JSON.",
      messages: [{ role: 'user', content: promptText }],
    });

    if (response.content[0].type === 'text') {
      const text = response.content[0].text;
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned) as { actions: { id: string, priority_rank: 'priority' | 'easy_win' | 'no_rush' }[] };
      newRanks = parsed.actions;
    } else {
      throw new Error('Unexpected response type from Claude');
    }
  } catch (e) {
    console.error('Failed to get next actions from Claude, using fallback heuristic:', e);
    usedFallback = true;
    
    // Fallback logic
    const fallbackTasks = [...tasksToRank];
    
    // Priority: any task with urgency keywords OR the single oldest incomplete task if none have urgency keywords
    const priorityKeywords = ['urgent', 'asap', 'deadline', 'today', 'critical', 'important'];
    let priorityTasks = fallbackTasks.filter(t => priorityKeywords.some(kw => t.text.toLowerCase().includes(kw)));
    
    if (priorityTasks.length === 0 && fallbackTasks.length > 0) {
      // Find single oldest
      const sortedByAge = [...fallbackTasks].sort((a, b) => a.created_at - b.created_at);
      priorityTasks = [sortedByAge[0]];
    }

    priorityTasks.forEach(pt => {
      newRanks.push({ id: pt.id, priority_rank: 'priority' });
    });

    // Easy Win: lowest estimated_minutes < 10
    const easyWinTasks = fallbackTasks.filter(t => 
      !priorityTasks.find(pt => pt.id === t.id) && 
      t.estimated_minutes !== undefined && 
      t.estimated_minutes < 10
    );

    easyWinTasks.forEach(ew => {
      newRanks.push({ id: ew.id, priority_rank: 'easy_win' });
    });
  }

  // Ensure ALL unranked tasks receive a rank in DB so we don't repeatedly ask Claude
  tasksToRank.forEach(t => {
    if (!newRanks.find(r => r.id === t.id)) {
      newRanks.push({ id: t.id, priority_rank: 'no_rush' });
    }
  });

  // Update DB with the new priority_ranks
  const updatePromises = newRanks.map(action => 
    supabase
      .from('dump_items')
      .update({ priority_rank: action.priority_rank })
      .eq('id', action.id)
  );
  
  await Promise.all(updatePromises);

  // Merge newly ranked tasks into the pool
  const newlyRankedTasks = newRanks.map(action => {
    const originalTask = tasks.find(t => t.id === action.id);
    return {
      ...originalTask!,
      priority_rank: action.priority_rank,
    };
  });

  const finalPool = [...alreadyRankedTasks, ...newlyRankedTasks];
  const finalFullList = getFullList(finalPool);

  if (usedFallback) {
    finalFullList.forEach(t => t.usedFallback = true);
  }

  return { success: true, data: finalFullList, usedFallback };
}
