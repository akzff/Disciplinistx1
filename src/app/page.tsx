'use client';

import { useState, useRef, useEffect } from 'react';
import { storage, Message, DailyChat, UserPreferences, ActiveTask, formatTime } from '@/lib/storage';
import Image from 'next/image';
import MissionsBoard from '@/components/MissionsBoard';
import MissionChecklist from '@/components/MissionChecklist';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NavigationBar } from '@/components/NavigationBar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { cloudStorage } from '@/lib/cloudStorage';
import { useAuthContext } from '@/lib/AuthContext';
import { useData } from '@/lib/DataContext';
import { useUser } from '@clerk/nextjs';
import '@/lib/manualMigration';
import { supabase } from '@/lib/supabase';
import GroupChat from '@/components/GroupChat';

// ─── Cross-platform real-time message sync ─────────────────────────────────
// Subscribes to Supabase Realtime on disciplinist_daily_chats.
// When any device saves new messages (after every send/receive),
// the UPDATE event fires and all other devices instantly merge the new messages.
function useRealtimeSync(
  userId: string | undefined,
  currentDate: string,
  setters: {
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    setChatStatus: React.Dispatch<React.SetStateAction<'OPEN' | 'CLOSED'>>;
    setActiveTasks: React.Dispatch<React.SetStateAction<ActiveTask[]>>;
    setDistractions: React.Dispatch<React.SetStateAction<string[]>>;
    setBotMood: React.Dispatch<React.SetStateAction<'NEUTRAL' | 'DISAPPOINTED' | 'HOPEFUL' | 'DOMINATOR'>>;
    setTodos: React.Dispatch<React.SetStateAction<DailyChat['todos']>>;
    setDailies: React.Dispatch<React.SetStateAction<DailyChat['dailies']>>;
    setCompletedTasks: React.Dispatch<React.SetStateAction<DailyChat['completedTasks']>>;
    setExpenses: React.Dispatch<React.SetStateAction<DailyChat['expenses']>>;
    setLocalChat: (date: string, chatData: Partial<DailyChat>) => void;
  }
) {
  const [syncStatus, setSyncStatus] = useState<'LIVE' | 'CONNECTING' | 'LOCAL'>('LOCAL');
  // Keep setters in a ref so the channel never re-subscribes when the parent re-renders
  const settersRef = useRef(setters);
  settersRef.current = setters;

  useEffect(() => {
    if (!userId || !currentDate) return;

    setSyncStatus('CONNECTING');

    const channel = supabase
      .channel(`chat-sync-${userId}-${currentDate}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'disciplinist_daily_chats',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as { date: string; data: DailyChat };
          // Only apply if this update is for the active date
          if (updated.date !== currentDate) return;

          const incomingData = updated.data;
          const s = settersRef.current;

          console.log('🔄 Chat updated from another device:', incomingData);

          // Update React state
          s.setMessages(incomingData.messages ?? []);
          s.setChatStatus(incomingData.status ?? 'OPEN');
          if (incomingData.activeTasks) s.setActiveTasks(incomingData.activeTasks);
          if (incomingData.distractions) s.setDistractions(incomingData.distractions);
          if (incomingData.botMood) s.setBotMood(incomingData.botMood);
          if (incomingData.todos) s.setTodos(incomingData.todos);
          if (incomingData.dailies) s.setDailies(incomingData.dailies);
          if (incomingData.completedTasks) s.setCompletedTasks(incomingData.completedTasks);
          if (incomingData.expenses) s.setExpenses(incomingData.expenses);

          // Update local cache
          s.setLocalChat(currentDate, incomingData);
        }
      )
      .subscribe((status) => {
        setSyncStatus(status === 'SUBSCRIBED' ? 'LIVE' : status === 'CHANNEL_ERROR' ? 'LOCAL' : 'CONNECTING');
      });

    return () => {
      supabase.removeChannel(channel);
      setSyncStatus('LOCAL');
    };
    // Only re-subscribe when user or date changes — not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, currentDate]);

  return { syncStatus };
}



// Strip model's internal reasoning tags before displaying
function cleanBotMessage(text: string): string {
  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

  // Handle unclosed tags (e.g., if model is still streaming or got cut off)
  if (cleaned.includes('<think>')) {
    cleaned = cleaned.split('<think>')[0];
  }
  if (cleaned.includes('<thinking>')) {
    cleaned = cleaned.split('<thinking>')[0];
  }

  return cleaned.trim();
}


export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState('');
  const [chatStatus, setChatStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [isPreviousDayOpen, setIsPreviousDayOpen] = useState(false);
  const [hideOverlay, setHideOverlay] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  const [previousDate, setPreviousDate] = useState('');
  const [activeDay, setActiveDay] = useState('');
  const [liveTab, setLiveTab] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    name: 'Disciple',
    bio: '',
    pfp: '',
    dayVision: '',
    dailyModel: '',
    ambition: '',
    mentorLevel: 1,
    habitNotes: [],
    selectedModel: 'qwen/qwen3-32b'
  });
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);
  const [distractions, setDistractions] = useState<string[]>([]);
  const [todos, setTodos] = useState<DailyChat['todos']>([]);
  const [dailies, setDailies] = useState<DailyChat['dailies']>([]);
  const [expenses, setExpenses] = useState<DailyChat['expenses']>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [botMood, setBotMood] = useState<'NEUTRAL' | 'DISAPPOINTED' | 'HOPEFUL' | 'DOMINATOR'>('NEUTRAL');
  const [completedTasks, setCompletedTasks] = useState<DailyChat['completedTasks']>([]);
  const [now, setNow] = useState(Date.now());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { signOut } = useAuthContext();
  const { user } = useUser();
  const { allChats, preferences: globalPrefs, updatePreferences: updateContextPrefs, setLocalChat, isSettingsOpen, setIsSettingsOpen, isCloudSynced } = useData();
  const saveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always use the cloud-synced name so it matches across all devices
  const displayName = globalPrefs?.name || preferences.name;

  // Close profile dropdown when clicking outside
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  useRealtimeSync(user?.id, activeDay || currentDate, {
    setMessages,
    setChatStatus,
    setActiveTasks,
    setDistractions,
    setBotMood,
    setTodos,
    setDailies,
    setCompletedTasks,
    setExpenses,
    setLocalChat
  });

  useEffect(() => {
    // Wait for cloud data before initializing — prevents stale localStorage flash
    if (isInitialized || !globalPrefs || !isCloudSynced) return;
    const init = async () => {
      setPreferences(globalPrefs);

      const today = storage.getCurrentDate();
      const prev = storage.getPreviousDay(today);

      setCurrentDate(today);
      setPreviousDate(prev);

      const prevChat = allChats[prev];
      const todayChat = allChats[today];

      console.log('Data init:', { today, prev, prevChat: !!prevChat, todayChat: !!todayChat });
      console.log('Prev chat data:', prevChat ? {
        todos: prevChat.todos?.length || 0,
        dailies: prevChat.dailies?.length || 0,
        todosIncomplete: prevChat.todos?.filter(t => !t.completed).length || 0
      } : 'No prev chat');

      if (prevChat && prevChat.status === 'OPEN') {
        setIsPreviousDayOpen(true);
        setActiveDay(prev);
        setMessages(prevChat.messages);
        setChatStatus('OPEN');
        setBotMood(prevChat.botMood || 'NEUTRAL');
        setActiveTasks(prevChat.activeTasks || []);
        setDistractions(prevChat.distractions || []);
        setTodos(prevChat.todos || []);
        setDailies(prevChat.dailies || []);
        setCompletedTasks(prevChat.completedTasks || []);
        setExpenses(prevChat.expenses || []);
      } else {
        setActiveDay(today);
        const defaults = {
          date: today, messages: [], status: 'OPEN' as const,
          activeTasks: [], distractions: [], todos: [], dailies: [], expenses: []
        };
        const base = todayChat || (prevChat ? {
          ...defaults,
          todos: prevChat.todos?.filter(t => !t.completed) || [],
          dailies: prevChat.dailies?.map(d => ({ ...d, completed: false })) || []
        } : defaults);

        console.log('Task carry-over:', {
          fromPrev: !!prevChat && !todayChat,
          todosCarried: base.todos?.length || 0,
          dailiesCarried: base.dailies?.length || 0
        });
        setMessages(base.messages);
        setChatStatus(base.status);
        setBotMood((base as typeof todayChat & { botMood?: string })?.botMood as typeof botMood || 'NEUTRAL');
        setActiveTasks(base.activeTasks || []);
        setDistractions(base.distractions || []);
        setTodos(base.todos || []);
        setDailies(base.dailies || []);
        setCompletedTasks((base as typeof todayChat)?.completedTasks || []);
        setExpenses(base.expenses || []);
        if (!todayChat) {
          cloudStorage.saveChat(today, base, user?.id || undefined, true);
          setLocalChat(today, base as DailyChat);
        }
      }
      setIsInitialized(true);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalPrefs, isCloudSynced, isInitialized]);

  // Debounced cloud save (2000ms) to avoid hammering Supabase on every keystroke
  useEffect(() => {
    if (!activeDay || !isInitialized) return;
    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    saveDebounce.current = setTimeout(() => {
      const chatD = { messages, status: chatStatus, activeTasks, distractions, botMood, todos, dailies, completedTasks, expenses };
      cloudStorage.saveChat(activeDay, chatD, user?.id || undefined, true);
      setLocalChat(activeDay, chatD as DailyChat);
    }, 2000);
    return () => { if (saveDebounce.current) clearTimeout(saveDebounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, chatStatus, activeDay, activeTasks, distractions, botMood, todos, dailies, completedTasks, expenses, isInitialized]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeTasks || activeTasks.length === 0) {
      document.title = "Disciplinist | Discipline Engine";
      return;
    }

    const runningTask = activeTasks.find(t => t.status === 'RUNNING');
    const pausedTask = activeTasks.find(t => t.status === 'PAUSED');
    const task = runningTask || pausedTask;

    if (task) {
      const activeTime = task.status === 'RUNNING'
        ? (task.totalActiveTime || 0) + Math.max(0, now - (task.lastStartedAt || task.startTime || now))
        : (task.totalActiveTime || 0);

      const timeStr = formatTime(activeTime).replace(/ /g, ''); // e.g. 1h20m30s
      const statusIcon = task.status === 'RUNNING' ? '▶' : '⏸';

      document.title = `${timeStr} ${statusIcon} ${task.name} | Disciplinist`;
    } else {
      document.title = "Disciplinist | Discipline Engine";
    }
  }, [activeTasks, now]);

  const handleSend = async (overrideInput?: string, overrideMessages?: Message[]) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || isLoading) return;

    // Check if this is a response to a task completion prompt
    const lastAssistantMessage = messages[messages.length - 1];
    if (lastAssistantMessage?.role === 'assistant' && lastAssistantMessage?.completedMission) {
      // Extract the task name from the completion prompt
      const taskName = lastAssistantMessage.completedMission.name;

      // Update the abandonment reason for the most recent completed task
      setCompletedTasks(prev => {
        if (!prev) return prev;
        const updated = [...prev];
        // Find the most recent completion of this task
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].name === taskName && !updated[i].abandonmentReason) {
            updated[i] = { ...updated[i], abandonmentReason: textToSend };
            break;
          }
        }
        return updated;
      });
    }

    // Cleanup pending task requests from previous messages
    const cleanedMessages = (overrideMessages || messages).map(msg => {
      if (msg.taskRequest?.status === 'PENDING') {
        return { ...msg, taskRequest: { ...msg.taskRequest, status: 'IGNORED' as const } };
      }
      return msg;
    });

    const userMessage: Message = { role: 'user', content: textToSend, timestamp: Date.now() };
    const newMessages = [...cleanedMessages, userMessage];

    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Compressed State for Token Optimization
      const completed = [
        ...(todos?.filter(t => t.completed).map(t => t.text) || []),
        ...(dailies?.filter(d => d.completed).map(d => d.text) || [])
      ].join(', ') || 'None';

      const pending = [
        ...(todos?.filter(t => !t.completed).map(t => t.text) || []),
        ...(dailies?.filter(d => !d.completed).map(d => d.text) || [])
      ].join(', ') || 'None';

      // Token Optimization: Last 8 messages for balance of context vs cost
      const contextMessages = newMessages.slice(-8).map(m => ({
        role: m.role,
        content: m.content
      }));

      // Only send Bio on start or if habits are few to save tokens
      const habitSummary = preferences.habitNotes.slice(0, 3).map(h => h.issue).join(', ');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: contextMessages,
          model: globalPrefs?.selectedModel || preferences.selectedModel,
          systemPrompt: `You are Disciplinist, a ruthless discipline coach.
                    USER: ${displayName}
                    AMBITION: ${globalPrefs?.ambition || preferences.ambition}
                    VISION: ${globalPrefs?.dailyModel || preferences.dailyModel}
                    STATUS_REPORT: 
                    - COMPLETED: ${completed}
                    - PENDING: ${pending}
                    - ACTIVE: ${activeTasks.length > 0 ? activeTasks.map(t => t.name).join(', ') : 'None'}
                    HABITS_LOG: ${habitSummary || 'None'}
                    TIME: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}

                    CORE RULES:
                    - NEVER suggest fixing a task in COMPLETED.
                    - Precision: LATENESS is a failure, but EARLY is excellent. Never critique early arrival.
                    - NO fake math/percentages.
                    - If user sends [Protocol Started], acknowledge it intensely and briefly (e.g., "Proceed.", "Do not fail.", "Acknowledged."). Do NOT say failed.
                    - INTENSITY: ${(globalPrefs?.mentorLevel || preferences.mentorLevel) === 1 ? 'Novice/Supportive' : (globalPrefs?.mentorLevel || preferences.mentorLevel) === 2 ? 'Elite/Strict' : 'Beast/Ruthless'}.
                    - Level 3 (Beast) requirement: Minimum words, maximum pressure, no mercy.
                    - Provide detailed, constructive feedback and guidance. Use bullet points when helpful.
                    - TRACK_EXPENSE: amount | description (Use if user mentions spending money)
                    - MOOD: 'HOPEFUL|DISAPPOINTED|DOMINATOR|NEUTRAL' (End with mood)
                    - Level: ${globalPrefs?.mentorLevel || preferences.mentorLevel} (1=Mid, 2=High, 3=Max)`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const data = await response.json();
      const aiContent = data.choices[0].message.content;

      // Parse Actions from AI Content
      let taskReqData = undefined;
      const taskMatch = aiContent.match(/TASK_REQUEST: ['"](.+?)['"]/i);
      if (taskMatch) {
        taskReqData = { name: taskMatch[1], status: 'PENDING' as const };
      }

      const moodMatch = aiContent.match(/MOOD: ['"](DISAPPOINTED|HOPEFUL|DOMINATOR|NEUTRAL)['"]/i);
      if (moodMatch) {
        setBotMood(moodMatch[1].toUpperCase() as 'NEUTRAL' | 'DISAPPOINTED' | 'HOPEFUL' | 'DOMINATOR');
      }

      const aiMessage: Message = {
        role: 'assistant',
        content: aiContent
          .replace(/TASK_REQUEST: ['"].+?['"]/gi, '')
          .replace(/MOOD: ['"].+?['"]/gi, '')
          .replace(/LOG_HABIT: ['"].+?['"]/gi, '')
          .replace(/TRACK_EXPENSE: .+? \| .+?/gi, '')
          .trim(),
        taskRequest: taskReqData,
        timestamp: Date.now()
      };

      setMessages((prev) => [...prev, aiMessage]);

      if (aiContent.includes('LOG_HABIT:')) {
        const match = aiContent.match(/LOG_HABIT: ['"](.+?)['"]/i);
        if (match) {
          const issue = match[1];
          const newIssue = { id: Date.now().toString(), date: activeDay, context: textToSend, issue };
          const newPrefs = { ...preferences, habitNotes: [newIssue, ...preferences.habitNotes] };
          setPreferences(newPrefs);
          storage.saveUserPreferences(newPrefs);
          setDistractions([issue, ...distractions]);
        }
      }

      const expenseMatch = aiContent.match(/TRACK_EXPENSE: ([\d.]+) \| (.+)/i);
      if (expenseMatch) {
        const amount = parseFloat(expenseMatch[1]);
        const text = expenseMatch[2].trim();
        if (!isNaN(amount)) {
          setExpenses(prev => [...(prev || []), { id: Date.now().toString(), amount, text }]);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Chat Error:', error);
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const approveTask = (messageIndex: number) => {
    const msg = messages[messageIndex];
    if (!msg.taskRequest) return;

    const newTask: ActiveTask = {
      id: Date.now().toString(),
      name: msg.taskRequest.name,
      startTime: Date.now(),
      status: 'RUNNING',
      totalActiveTime: 0,
      totalPausedTime: 0,
      lastStartedAt: Date.now()
    };

    const updatedMessages = [...messages];
    updatedMessages[messageIndex] = {
      ...msg,
      taskRequest: { ...msg.taskRequest, status: 'APPROVED' }
    };

    setMessages(updatedMessages);
    setActiveTasks([newTask, ...activeTasks]);
  };

  const startManualTask = (name: string) => {
    if (!name.trim()) return;
    const newTask: ActiveTask = {
      id: Date.now().toString(),
      name: name.trim(),
      startTime: Date.now(),
      status: 'RUNNING',
      totalActiveTime: 0,
      totalPausedTime: 0,
      lastStartedAt: Date.now()
    };
    setActiveTasks([newTask, ...activeTasks]);

    // Notify the bot
    handleSend(`[Protocol Started]: Mission "${name.trim()}" is now live.`);
  };
  const startEdit = (index: number, content: string) => {
    setEditingIndex(index);
    setEditValue(content);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const updatedMessages = [...messages.slice(0, editingIndex)];
    setMessages(updatedMessages);
    setEditingIndex(null);
    setEditValue('');
    handleSend(editValue, updatedMessages);
  };

  const toggleTask = (taskId: string) => {
    setActiveTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const timestamp = Date.now();
        if (t.status === 'RUNNING') {
          const activeNow = timestamp - (t.lastStartedAt || t.startTime || timestamp);
          return {
            ...t,
            status: 'PAUSED',
            totalActiveTime: (t.totalActiveTime || 0) + (activeNow > 0 ? activeNow : 0),
            lastPausedAt: timestamp
          };
        } else {
          const pausedNow = timestamp - (t.lastPausedAt || t.startTime || timestamp);
          return {
            ...t,
            status: 'RUNNING',
            totalPausedTime: (t.totalPausedTime || 0) + (pausedNow > 0 ? pausedNow : 0),
            lastStartedAt: timestamp
          };
        }
      }
      return t;
    }));
  };

  const closeTask = (taskId: string) => {
    setActiveTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const timestamp = Date.now();
      const finalActiveTime = task.status === 'RUNNING'
        ? (task.totalActiveTime || 0) + Math.max(0, timestamp - (task.lastStartedAt || task.startTime || timestamp))
        : (task.totalActiveTime || 0);
      const finalPausedTime = task.status === 'PAUSED'
        ? (task.totalPausedTime || 0) + Math.max(0, timestamp - (task.lastPausedAt || task.startTime || timestamp))
        : (task.totalPausedTime || 0);

      // Emit a rich completedMission card instead of plain text
      setMessages(prevMsgs => [...prevMsgs, {
        role: 'assistant',
        content: `How did "${task.name}" go? Share your reflection. If you abandoned or switched tasks, explain what triggered it.`,
        completedMission: {
          name: task.name,
          startTime: task.startTime,
          endTime: timestamp,
          activeTime: finalActiveTime,
          pausedTime: finalPausedTime,
        },
        timestamp: timestamp
      }]);

      setCompletedTasks(prevCompleted => [
        ...(prevCompleted || []),
        {
          name: task.name,
          activeTime: finalActiveTime,
          pausedTime: finalPausedTime,
          finishedAt: timestamp,
          abandonmentReason: '' // Will be filled when user responds
        }
      ]);

      return prev.filter(t => t.id !== taskId);
    });
  };

  const startMyDay = () => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const greeting = `Namaste. It is ${time}. You are awake. How did you spend your time since last night? Give me a rough idea so we can begin your mission for today.`;
    setMessages([{ role: 'assistant', content: greeting, timestamp: Date.now() }]);
    setChatStatus('OPEN');
  };

  const closePreviousDay = async () => {
    await cloudStorage.closeChat(activeDay, user?.id || undefined);
    setIsPreviousDayOpen(false);
    const today = storage.getCurrentDate();
    setActiveDay(today);

    // Load today from cloud
    const todayChat = await cloudStorage.getChat(today);
    const base = todayChat || { date: today, messages: [], status: 'OPEN' as const, activeTasks: [], distractions: [], todos: [], dailies: [], expenses: [] };

    setMessages(base.messages);
    setChatStatus(base.status);
    setActiveTasks(base.activeTasks || []);
    setDistractions(base.distractions || []);
    setBotMood((base as typeof todayChat & { botMood?: string })?.botMood as typeof botMood || 'NEUTRAL');
    setTodos(base.todos || []);
    setDailies(base.dailies || []);
    setCompletedTasks((base as typeof todayChat)?.completedTasks || []);
    setExpenses(base.expenses || []);
    if (!todayChat) await cloudStorage.saveChat(today, base, user?.id || undefined, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Global verification function for testing (accessible from browser console)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as { verifySupabaseData?: () => Promise<{ status: 'ok' | 'error', details: { user?: string; totalChats?: number; todayDataExists?: boolean; todayTodos?: number; todayDailies?: number; allTodos?: number; allDailies?: number; datesWithData?: string[]; error?: string; } }> }).verifySupabaseData = async () => {
        const result = await cloudStorage.verifyDataIntegrity();
        console.table(result.details);
        return result;
      };
    }
  }, []);



  return (
    <main>
      <div className="bg-mesh"></div>

      <div className="chat-container">
        <header className="chat-header">

          <div className="chat-header__left" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              className="status-indicator"
              style={{
                '--mood-color': botMood === 'DISAPPOINTED' ? '#ef4444' : botMood === 'HOPEFUL' ? '#10b981' : botMood === 'DOMINATOR' ? '#8b5cf6' : '#6b7280'
              } as React.CSSProperties}
            ></div>
            <div>
              <h1 className="app-title" style={{ marginBottom: '2px' }}>
                <span className="app-title__brand">DISCIPLINIST</span>
              </h1>
              <div className="chat-header__subtitleRow" style={{ marginTop: '0' }}>
                <p className="session-subtitle">{activeDay === currentDate ? 'TODAY' : 'YESTERDAY'}&apos;S SESSION</p>
                {isPreviousDayOpen && hideOverlay && (
                  <button onClick={closePreviousDay} className="close-prev-btn">
                    CLOSE YESTERDAY
                  </button>
                )}
              </div>
            </div>
            {/* AI / Live tab switcher */}
            <div style={{
              display: 'flex',
              gap: '4px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '100px',
              padding: '3px',
              marginLeft: '8px',
              flexShrink: 0,
            }}>
              <button
                onClick={() => setLiveTab(false)}
                style={{
                  padding: '5px 14px',
                  borderRadius: '100px',
                  border: 'none',
                  fontSize: '0.65rem',
                  fontWeight: '800',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: !liveTab ? 'rgba(212,160,23,0.2)' : 'transparent',
                  color: !liveTab ? '#d4a017' : 'rgba(255,255,255,0.4)',
                  boxShadow: !liveTab ? '0 2px 10px rgba(212,160,23,0.15)' : 'none',
                }}
              >AI</button>
              <button
                onClick={() => setLiveTab(true)}
                style={{
                  padding: '5px 14px',
                  borderRadius: '100px',
                  border: 'none',
                  fontSize: '0.65rem',
                  fontWeight: '800',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: liveTab ? 'rgba(16,185,129,0.2)' : 'transparent',
                  color: liveTab ? '#10b981' : 'rgba(255,255,255,0.4)',
                  boxShadow: liveTab ? '0 2px 10px rgba(16,185,129,0.15)' : 'none',
                }}
              >
                <span style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: '#10b981',
                  flexShrink: 0,
                  animation: 'nav-live-pulse 2s ease-in-out infinite',
                }} />
                LIVE
              </button>
            </div>
          </div>

          <div className="nav-center-wrapper desktop-only" style={{ flex: 2, display: 'flex', justifyContent: 'center' }}>
            <NavigationBar />
          </div>

          <div className="header-controls" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="header-action-btn"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 1 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>

              {/* Profile dropdown */}
              <div className="profile-dropdown-wrapper" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '4px 10px', borderRadius: '100px',
                    background: profileOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(10px)', cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '900', boxShadow: '0 2px 10px rgba(139, 92, 246, 0.3)', flexShrink: 0 }}>
                    {user?.primaryEmailAddress?.emailAddress?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="mobile-hidden" style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '700' }}>
                    {displayName}
                  </span>
                  <svg className="mobile-hidden" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                {profileOpen && (
                  <div className="profile-dropdown">
                    <div className="profile-dropdown__header">
                      <p className="profile-dropdown__email">{user?.primaryEmailAddress?.emailAddress}</p>
                    </div>
                    <button className="profile-dropdown__item" onClick={() => { setIsSettingsOpen(true); setProfileOpen(false); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 1 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                      Settings
                    </button>
                    <button className="profile-dropdown__item profile-dropdown__item--danger" onClick={() => { setProfileOpen(false); signOut(); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

          {/* ── Live Chat Tab ─────────────────────────────────────── */}
          {liveTab && user && (
            <GroupChat
              userId={user.id}
              userName={globalPrefs?.name || preferences.name || 'Disciple'}
              userAvatar={globalPrefs?.pfp || preferences.pfp || undefined}
            />
          )}

          {/* ── AI Chat Tab ────────────────────────────────────── */}
          <div style={{ display: liveTab ? 'none' : 'grid', gridTemplateColumns: '300px 1fr', flex: 1, height: '100%', width: '100%', overflow: 'hidden' }}>

            <MissionChecklist
              todos={todos}
              dailies={dailies}
              sidebarOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              onToggleTodo={(id: string) => setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t))}
              onToggleDaily={(id: string) => setDailies(prev => prev.map(d => d.id === id ? { ...d, completed: !d.completed } : d))}
              onReorderTodo={(newTodos: DailyChat['todos']) => setTodos(newTodos)}
              onReorderDaily={(newDailies: DailyChat['dailies']) => setDailies(newDailies)}
              onStartLiveMission={startManualTask}
              onAddDaily={(text) => setDailies(prev => [...prev, { id: Date.now().toString(), text, completed: false }])}
              onEditDaily={(id, text) => setDailies(prev => prev.map(d => d.id === id ? { ...d, text } : d))}
              onDeleteDaily={(id) => setDailies(prev => prev.filter(d => d.id !== id))}
              onAddTodo={(text) => setTodos(prev => [...prev, { id: Date.now().toString(), text, completed: false }])}
              onEditTodo={(id, text) => setTodos(prev => prev.map(t => t.id === id ? { ...t, text } : t))}
              onDeleteTodo={(id) => setTodos(prev => prev.filter(t => t.id !== id))}
            />

            <main style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0, position: 'relative' }}>

              {isPreviousDayOpen && !hideOverlay && (
                <div className="overlay">
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
                  <h2 style={{ marginBottom: '1rem' }}>Yesterday Not Closed</h2>
                  <p style={{ maxWidth: '400px', opacity: 0.8, marginBottom: '2rem' }}>
                    You haven&apos;t told the bot how you spent the end of <b>{previousDate}</b>.
                    Complete the details before starting today.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '300px' }}>
                    <button className="start-day-btn" style={{ fontSize: '0.9rem', padding: '1rem' }} onClick={closePreviousDay}>
                      I&apos;ve Told Everything
                    </button>
                    <button className="start-day-btn" style={{ fontSize: '0.8rem', padding: '0.8rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', boxShadow: 'none', color: 'rgba(255,255,255,0.6)' }} onClick={() => setHideOverlay(true)}>
                      I have things left to say
                    </button>
                  </div>
                </div>
              )}

              <div className="chat-messages" ref={scrollRef}>

                {/* Loading spinner while waiting for cloud sync */}
                {!isCloudSynced && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', opacity: 0.5 }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d4a017', animation: 'dot-pulse 1.5s infinite' }} />
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>SYNCING FROM CLOUD...</p>
                  </div>
                )}

                {isInitialized && messages.length === 0 && (
                  <div className="start-day-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem', textAlign: 'center', animation: 'slideIn 0.8s cubic-bezier(0.16, 1, 0.3, 1)', position: 'relative' }}>
                    <div style={{ position: 'absolute', width: '30vw', height: '30vw', background: 'radial-gradient(circle, rgba(212,160,23,0.15) 0%, transparent 60%)', filter: 'blur(40px)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 0, animation: 'pulse-glow 4s infinite alternate' }} />
                    <div style={{ zIndex: 1, position: 'relative', marginBottom: '2rem' }}>
                      <div style={{ fontSize: '5rem', filter: 'drop-shadow(0 0 30px var(--accent-glow))', animation: 'float 6s ease-in-out infinite' }}>🌅</div>
                      <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: '900', letterSpacing: '-0.04em', background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.6) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '1rem 0 0.5rem' }}>A New Day Begins</h2>
                      <p style={{ opacity: 0.6, fontSize: '1.1rem', maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>Your slate is wiped clean. Set your intentions, log your priorities, and conquer the hours ahead.</p>
                    </div>
                    <button className="start-day-btn" onClick={startMyDay} style={{ zIndex: 1, padding: '16px 40px', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.1em', borderRadius: '100px', background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%)', boxShadow: '0 10px 30px rgba(212,160,23,0.3)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                      START MY DAY
                    </button>
                    <style>{`
                      @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }
                      @keyframes pulse-glow { 0% { opacity: 0.5; transform: translate(-50%, -50%) scale(0.9); } 100% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); } }
                      .start-day-btn:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 15px 40px rgba(212,160,23,0.5) !important; filter: brightness(1.1); }
                    `}</style>
                  </div>
                )}


                {messages.map((msg, i) => (
                  <div key={i} className={`message-wrapper ${msg.role}`}>
                    {editingIndex === i ? (
                      <div style={{ width: '100%', maxWidth: '80%' }}>
                        <textarea
                          className="edit-textarea"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } }}
                          autoFocus
                        />
                        <div className="edit-actions">
                          <button className="edit-save" onClick={saveEdit}>Save & Resend</button>
                          <button className="edit-cancel" onClick={() => setEditingIndex(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="message-meta">
                          {msg.role === 'user' ? (
                            <>
                              <span className="profile-name">{displayName}</span>
                              {preferences.pfp ? (
                                <Image src={preferences.pfp} alt="pfp" className="pfp-icon" width={32} height={32} />
                              ) : (
                                <div className="pfp-icon" style={{ background: 'var(--accent)', opacity: 0.5 }}></div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="pfp-icon" style={{ background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>🧘</div>
                              <span className="profile-name">DISCIPLINIST</span>
                            </>
                          )}
                        </div>
                        <div className={`message ${msg.role}`}>
                          {msg.completedMission ? (
                            <div className="mission-complete-card">
                              <div className="mc-header">
                                <span className="mc-icon">✅</span>
                                <div>
                                  <p className="mc-label">TASK COMPLETE</p>
                                  <p className="mc-title">{msg.completedMission.name}</p>
                                </div>
                              </div>
                              <div className="mc-grid">
                                <div className="mc-stat">
                                  <span className="mc-stat-label">START TIME</span>
                                  <span className="mc-stat-value">{new Date(msg.completedMission.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                </div>
                                <div className="mc-stat">
                                  <span className="mc-stat-label">END TIME</span>
                                  <span className="mc-stat-value">{new Date(msg.completedMission.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                </div>
                                <div className="mc-stat mc-accent">
                                  <span className="mc-stat-label">⚡ ACTIVE TIME</span>
                                  <span className="mc-stat-value">{formatTime(msg.completedMission.activeTime)}</span>
                                </div>
                                <div className="mc-stat">
                                  <span className="mc-stat-label">⏸ PAUSED TIME</span>
                                  <span className="mc-stat-value">{formatTime(msg.completedMission.pausedTime)}</span>
                                </div>
                                <div className="mc-stat mc-wide">
                                  <span className="mc-stat-label">⏱ TOTAL DURATION</span>
                                  <span className="mc-stat-value">{formatTime(msg.completedMission.endTime - msg.completedMission.startTime)}</span>
                                </div>
                              </div>
                              <p className="mc-prompt">{msg.content}</p>
                            </div>
                          ) : msg.role === 'assistant' ? (
                            <div className="chat-md">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  img: ({ src, ...props }) => src && typeof src === 'string' ? <Image src={src} {...props} style={{ maxWidth: '100%', borderRadius: '12px', marginTop: '10px' }} alt="AI generated" width={0} height={0} sizes="100vw" /> : null,
                                  a: ({ href, ...props }) => {
                                    const isImage = href?.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i);
                                    if (isImage && href && typeof href === 'string') {
                                      return <Image src={href} style={{ maxWidth: '100%', borderRadius: '12px', marginTop: '10px', display: 'block' }} alt="AI generated" width={0} height={0} sizes="100vw" />;
                                    }
                                    return <a href={href} {...props} target="_blank" rel="noopener noreferrer" />;
                                  }
                                }}
                              >
                                {cleanBotMessage(msg.content)}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            msg.content
                          )}

                          {msg.taskRequest?.status === 'PENDING' && (
                            <div className="task-request-inline">
                              <h4>Start task?</h4>
                              <p>{msg.taskRequest.name}</p>
                              <button className="approve-btn" onClick={() => approveTask(i)}>Start</button>
                            </div>
                          )}
                        </div>
                        {msg.role === 'user' && (
                          <button className="edit-btn" onClick={() => startEdit(i, msg.content)}>Edit</button>
                        )}
                      </>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="message ai">
                    <div className="typing-indicator">
                      <div className="dot"></div><div className="dot"></div><div className="dot"></div>
                    </div>
                  </div>
                )}

                {activeTasks.map(task => {
                  const activeTime = task.status === 'RUNNING'
                    ? (task.totalActiveTime || 0) + Math.max(0, now - (task.lastStartedAt || task.startTime || now))
                    : (task.totalActiveTime || 0);
                  const pausedTime = task.status === 'PAUSED'
                    ? (task.totalPausedTime || 0) + Math.max(0, now - (task.lastPausedAt || task.startTime || now))
                    : (task.totalPausedTime || 0);

                  return (
                    <div key={task.id} className="active-tasks-card">
                      <div style={{ fontSize: '1.5rem' }}>{task.status === 'RUNNING' ? '🔥' : '⏸️'}</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: '700', textTransform: 'uppercase' }}>Current Task</p>
                        <p style={{ fontWeight: '800' }}>{task.name}</p>
                        <p style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '2px' }}>
                          Active: {formatTime(activeTime, false)} | Paused: {formatTime(pausedTime, false)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => toggleTask(task.id)} className="edit-cancel" style={{ fontSize: '0.7rem' }}>
                          {task.status === 'RUNNING' ? 'Pause' : 'Resume'}
                        </button>
                        <button onClick={() => closeTask(task.id)} className="edit-save" style={{ fontSize: '0.7rem' }}>
                          Finish
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input area (AI chat only) */}
              {messages.length > 0 && (
                <div className="input-area">
                  <div className="input-wrapper">
                    <textarea
                      placeholder="Message your coach..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${target.scrollHeight}px`;
                      }}
                    />
                    <button className="send-button" onClick={() => handleSend()} disabled={!input.trim() || isLoading}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                    </button>
                  </div>
                </div>
              )}

            </main>
            {/* ── closes AI Chat Tab wrapper ── */}
          </div>

        </div>


        <style jsx global>{`
                @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
                .setting-item { padding: 12px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); }

                /* Mission Complete Card */
                .mission-complete-card {
                  background: linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(0,0,0,0) 100%);
                  border: 1px solid rgba(16,185,129,0.3);
                  border-radius: 20px;
                  padding: 1.2rem 1.4rem;
                  display: flex;
                  flex-direction: column;
                  gap: 1rem;
                  min-width: 280px;
                  box-shadow: 0 0 30px rgba(16,185,129,0.08);
                }
                .mc-header {
                  display: flex;
                  align-items: center;
                  gap: 12px;
                  padding-bottom: 0.8rem;
                  border-bottom: 1px solid rgba(16,185,129,0.15);
                }
                .mc-icon { font-size: 1.6rem; }
                .mc-label {
                  font-size: 0.55rem;
                  font-weight: 900;
                  letter-spacing: 0.2em;
                  color: #10b981;
                  opacity: 0.7;
                  margin: 0;
                }
                .mc-title {
                  font-size: 1rem;
                  font-weight: 800;
                  color: white;
                  margin: 2px 0 0 0;
                }
                .mc-grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 10px;
                }
                .mc-stat {
                  background: rgba(255,255,255,0.03);
                  border: 1px solid rgba(255,255,255,0.06);
                  border-radius: 12px;
                  padding: 10px 12px;
                  display: flex;
                  flex-direction: column;
                  gap: 4px;
                }
                .mc-stat.mc-accent {
                  background: rgba(16,185,129,0.1);
                  border-color: rgba(16,185,129,0.25);
                }
                .mc-stat.mc-wide {
                  grid-column: span 2;
                  background: rgba(255,255,255,0.02);
                }
                .mc-stat-label {
                  font-size: 0.55rem;
                  font-weight: 900;
                  letter-spacing: 0.15em;
                  opacity: 0.45;
                  text-transform: uppercase;
                }
                .mc-stat.mc-accent .mc-stat-label { color: #10b981; opacity: 0.8; }
                .mc-stat-value {
                  font-size: 0.95rem;
                  font-weight: 800;
                  color: white;
                }
                .mc-stat.mc-accent .mc-stat-value { color: #10b981; }
                .mc-prompt {
                  font-size: 0.8rem;
                  opacity: 0.6;
                  margin: 0;
                  padding-top: 0.5rem;
                  border-top: 1px solid rgba(255,255,255,0.05);
                  font-style: italic;
                }
            `}</style>
        {
          showMissions && (
            <MissionsBoard
              chat={{ date: activeDay, messages, status: chatStatus, activeTasks, distractions, botMood, todos, dailies, completedTasks }}
              onUpdate={(updates) => {
                if (updates.todos) setTodos(updates.todos);
                if (updates.dailies) setDailies(updates.dailies);
              }}
              onClose={() => setShowMissions(false)}
            />
          )
        }
        <MobileBottomNav
          onTasksPress={() => setSidebarOpen(v => !v)}
          tasksActive={sidebarOpen}
        />
      </div>
    </main >
  );
}
