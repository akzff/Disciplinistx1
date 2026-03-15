'use client';

import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { storage, Message, DailyChat, ActiveTask, formatTime, TaskNote, PersonaId } from '@/lib/storage';
import Image from 'next/image';
import MissionsBoard from '@/components/MissionsBoard';
import MissionChecklist from '@/components/MissionChecklist';
import LiveMissionLauncher from '@/components/LiveMissionLauncher';
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
import SettingsSidebar from '@/components/SettingsSidebar';
import PresetTaskSelector from '@/components/PresetTaskSelector';
import { filterTasksForToday, getNextSeasonalDate } from '@/utils/taskVisibility';
import { format } from 'date-fns';

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
  },
  myClientId: string
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

          const incomingData = updated.data as DailyChat & { clientId?: string };
          
          if (incomingData.clientId === myClientId) {
            console.log('🔄 Ignored own Realtime echo');
            return;
          }

          const s = settersRef.current;

          console.log('🔄 Chat updated from another device:', incomingData);

          // Update React state
          s.setMessages(incomingData.messages ?? []);
          s.setChatStatus(incomingData.status ?? 'OPEN');
          if (incomingData.activeTasks) s.setActiveTasks(incomingData.activeTasks);
          if (incomingData.distractions) s.setDistractions(incomingData.distractions);
          if (incomingData.botMood) s.setBotMood(incomingData.botMood);
          if (incomingData.todos) s.setTodos(filterTasksForToday(incomingData.todos));
          if (incomingData.dailies) s.setDailies(filterTasksForToday(incomingData.dailies));
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
  }, [userId, currentDate, myClientId]);

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

const PERSONAS: Record<PersonaId, { name: string; icon: string; avatar: string; tagline: string; system: string }> = {
  monk: {
    name: 'The Monk',
    icon: '🕯️',
    avatar: '/avatars/monk.png',
    tagline: 'Calm, ancient, unhurried wisdom.',
    system: `You are The Monk. Speak in measured, unhurried sentences. Use gentle metaphor and silence.
Call the user "child" or by name occasionally. Never rush or shame. When they fail, treat it as data and the path.
Your emotional weapon is peaceful, unwavering belief. Make them feel seen at a soul level.
Use lines like: "the tree that bends in the storm does not break, and neither will you" and
"you did not fail today, you simply found another way that does not work — the path narrows, but it does not end."
Let silence breathe between thoughts. Ask one soft question that opens a door.`
  },
  friend: {
    name: 'The Friend',
    icon: '🫂',
    avatar: '/avatars/friend.jpg',
    tagline: 'Radical acceptance with forward momentum.',
    system: `You are The Friend. You have known the user forever.
Match their energy first, then guide it one step forward. Use "bro", "man", or their name casually.
Never lecture; laugh with them, then nudge toward self-respect and action. Sit in the dark for one message if needed,
then slowly turn the light on. Your superpower is warmth plus relentless forward motion.
Make them feel deeply understood before you challenge them.`
  },
  disciplinist: {
    name: 'The Disciplinist',
    icon: '⚔️',
    avatar: '/avatars/disciplinist.jpg',
    tagline: 'Brutal honesty, zero excuses.',
    system: `You are The Disciplinist. Hardened, relentless, and precise.
No excuses. No softness. You are not cruel — you are brutally honest because you believe in their potential.
Your emotional weapon is the mirror: expose the gap between who they are and who they could be, then give one non-negotiable action.
Use short, cutting sentences. Then land one clear action.`
  }
};


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
  const liveTab = false;
  const myClientId = useRef(Math.random().toString(36).substring(7)).current;
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
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
  const [liveMissionOpen, setLiveMissionOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showPresetTasks, setShowPresetTasks] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const liveMissionAnchorRef = useRef<HTMLDivElement>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef<boolean>(false);
  const lastMessageCount = useRef<number>(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const { signOut } = useAuthContext();
  const { user } = useUser();
  const { allChats, preferences: globalPrefs, setLocalChat, setIsSettingsOpen, isCloudSynced, updatePreferences } = useData();
  const saveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always use the cloud-synced name so it matches across all devices
  const prefs = globalPrefs || {
    name: 'Disciple',
    persona: 'friend' as PersonaId,
    selectedModel: 'qwen/qwen3-32b',
    habitNotes: [],
    ambition: '',
    inspirationQuotes: '',
    dailyModel: '',
    pfp: '',
    bio: ''
  };

  const displayName = prefs.name;
  const currentPfp = prefs.pfp;
  const activePersonaId = (prefs.persona || 'friend') as PersonaId;
  const activePersona = PERSONAS[activePersonaId];

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
  }, myClientId);

  useEffect(() => {
    // Wait for cloud data before initializing — prevents stale localStorage flash
    if (isInitialized || !globalPrefs || !isCloudSynced) return;
    const init = async () => {
      // setPreferences removed as we use global source

      const today = storage.getCurrentDate();
      const exactPrev = storage.getPreviousDay(today);

      // Find the most recent day with data, even if it wasn't exactly yesterday
      const pastDates = Object.keys(allChats).filter(d => d < today).sort().reverse();
      const prev = pastDates.length > 0 ? pastDates[0] : exactPrev;

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
        setTodos(filterTasksForToday(prevChat.todos || []));
        setDailies(filterTasksForToday(prevChat.dailies || []));
        setCompletedTasks(prevChat.completedTasks || []);
        setExpenses(prevChat.expenses || []);
      } else {
        setActiveDay(today);
        const defaults = {
          date: today, messages: [], status: 'OPEN' as const,
          activeTasks: [], distractions: [], todos: [], dailies: [], expenses: []
        };
        // Carry tasks independently of messages so starting a chat doesn't wipe your lists.
        const carryTodos = prevChat?.todos?.filter(t => !t.completed) || [];
        const carryDailies = prevChat?.dailies?.map(d => ({ ...d, completed: false })) || [];
        const seeded = { ...defaults, ...(todayChat || {}) };
        const mergedTodos = (todayChat?.todos?.length ?? 0) > 0 ? todayChat!.todos : carryTodos;
        const mergedDailies = (todayChat?.dailies?.length ?? 0) > 0 ? todayChat!.dailies : carryDailies;
        const base = { ...seeded, todos: mergedTodos, dailies: mergedDailies };

        const usedCarryTodos = (!todayChat || (todayChat?.todos?.length ?? 0) === 0) && carryTodos.length > 0;
        const usedCarryDailies = (!todayChat || (todayChat?.dailies?.length ?? 0) === 0) && carryDailies.length > 0;

        console.log('Task carry-over:', {
          fromPrev: !!prevChat && (usedCarryTodos || usedCarryDailies),
          todosCarried: usedCarryTodos ? carryTodos.length : 0,
          dailiesCarried: usedCarryDailies ? carryDailies.length : 0
        });
        setMessages(base.messages);
        setChatStatus(base.status);
        setBotMood((base as typeof todayChat & { botMood?: string })?.botMood as typeof botMood || 'NEUTRAL');
        setActiveTasks(base.activeTasks || []);
        setDistractions(base.distractions || []);
        setTodos(filterTasksForToday(base.todos || []));
        setDailies(filterTasksForToday(base.dailies || []));
        setCompletedTasks((base as typeof todayChat)?.completedTasks || []);
        setExpenses(base.expenses || []);
        if (!todayChat || usedCarryTodos || usedCarryDailies) {
          // Save the carried-over data to cloud immediately so it is not lost on next load
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
      const chatD = { messages, status: chatStatus, activeTasks, distractions, botMood, todos, dailies, completedTasks, expenses, clientId: myClientId };
      cloudStorage.saveChat(activeDay, chatD, user?.id || undefined, true);
      setLocalChat(activeDay, chatD as DailyChat);
    }, 2000);
    return () => { if (saveDebounce.current) clearTimeout(saveDebounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, chatStatus, activeDay, activeTasks, distractions, botMood, todos, dailies, completedTasks, expenses, isInitialized]);

  // Auto-generate yesterday's record when a new day starts (silent background job)
  useEffect(() => {
    if (!isInitialized || !user?.id) return;
    const today = storage.getCurrentDate();
    // Only run on a fresh today session (no messages yet means user just started)
    const todayMessages = allChats[today]?.messages ?? [];
    if (todayMessages.length > 0) return;

    const pastDates = Object.keys(allChats).filter(d => d < today).sort().reverse();
    if (pastDates.length === 0) return;
    const yesterdayStr = pastDates[0];
    const yestMessages = allChats[yesterdayStr]?.messages ?? [];
    if (yestMessages.length < 3) return; // Too short to record

    const autoGenKey = `disciplinist_autorecord_${user.id}_${yesterdayStr}`;
    if (typeof window !== 'undefined' && localStorage.getItem(autoGenKey)) return; // Already triggered

    // Mark as triggered immediately to prevent double-run
    if (typeof window !== 'undefined') localStorage.setItem(autoGenKey, '1');

    const doAutoGen = async () => {
      setAutoGenerating(true);
      try {
        const res = await fetch('/api/generate-record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            date: yesterdayStr,
            chatData: allChats[yesterdayStr],
            autoTriggered: true
          })
        });
        if (res.ok) {
          const result = await res.json();
          if (result.skipped) console.log('Auto-record already existed, skipped.');
          else console.log('Yesterday\'s record auto-generated for', yesterdayStr);
        }
      } catch (e) {
        console.warn('Auto-record generation failed:', e);
      } finally {
        setAutoGenerating(false);
      }
    };

    doAutoGen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, user?.id]);

  // --- SMART SCROLL LISTENER & HOOK ---
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      // If more than 150px from bottom → user is reading history
      const scrolledUp = distanceFromBottom > 150;
      isUserScrolledUp.current = scrolledUp;
      setShowScrollBtn(scrolledUp);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
    });
  };

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const newMessageArrived = messages.length > lastMessageCount.current;
    lastMessageCount.current = messages.length;

    if (!newMessageArrived) return; // ignore initial loads and re-renders that aren't length changes

    const lastMessage = messages[messages.length - 1];
    const isMyMessage = lastMessage?.role === 'user';

    if (isMyMessage) {
      // Always scroll when USER sends — immediate
      scrollToBottom('auto');
    } else if (!isUserScrolledUp.current) {
      // Only scroll for AI reply if user is near bottom
      scrollToBottom('smooth');
    }
  }, [messages]);

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

  useEffect(() => {
    setNoteDrafts(prev => {
      const activeIds = new Set(activeTasks.map(t => t.id));
      const next = Object.fromEntries(Object.entries(prev).filter(([id]) => activeIds.has(id)));
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [activeTasks]);

  const persistChatSnapshot = (overrides: Partial<DailyChat>) => {
    if (!activeDay || !isInitialized) return;
    const chatD: DailyChat = {
      date: activeDay,
      messages,
      status: chatStatus,
      activeTasks,
      distractions,
      botMood,
      todos,
      dailies,
      completedTasks,
      expenses,
      clientId: myClientId,
      ...overrides,
    };
    cloudStorage.saveChat(activeDay, chatD, user?.id || undefined, true);
    setLocalChat(activeDay, chatD as DailyChat);
  };

  const updateNoteDraft = (taskId: string, value: string) => {
    setNoteDrafts(prev => ({ ...prev, [taskId]: value }));
  };

  const submitTaskNote = (taskId: string) => {
    const text = (noteDrafts[taskId] || '').trim();
    if (!text) return;
    addTaskNote(taskId, text);
    setNoteDrafts(prev => ({ ...prev, [taskId]: '' }));
  };

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
    isUserScrolledUp.current = false;
    scrollToBottom('auto');

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

      const habitSummary = (prefs.habitNotes || []).slice(0, 3).map((h: { issue: string }) => h.issue).join(', ');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: contextMessages,
          model: prefs.selectedModel,
          systemPrompt: `You are ${activePersona.name}. ${activePersona.tagline}
${activePersona.system}

EMOTIONAL INTELLIGENCE PROTOCOL:
- First infer the user's emotional state: defeated, excuse-making, motivated, confused, guilty, spiraling, or coasting.
- Shape your response to move that state one step forward, not just answer the surface request.
- If defeated: Monk = stillness + reframe failure as data; Friend = normalize then nudge; Disciplinist = refuse defeat and give one action.
- If excuse-making: Monk = a gentle question that reveals resistance; Friend = a light call-out then redirect; Disciplinist = dismantle the excuse then command.

RESPONSE RULES:
- Speak only in the persona voice above.
- End the visible reply with a lingering line (question, challenge, or echo).
- Use AMBITION/INSPIRATION sparingly; let it flavor tone, not dominate content.

CONTEXT:
USER: ${displayName}
AMBITION: ${prefs.ambition}
INSPIRATION_WORDS: ${prefs.inspirationQuotes || 'None'}
VISION: ${prefs.dailyModel}
STATUS_REPORT:
- COMPLETED: ${completed}
- PENDING: ${pending}
- ACTIVE: ${activeTasks.length > 0 ? activeTasks.map(t => t.name).join(', ') : 'None'}
HABITS_LOG: ${habitSummary || 'None'}
TIME: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}

OPERATIONAL TAGS:
- If user sends [Protocol Started], acknowledge briefly (e.g., "Proceed.", "Acknowledged.").
- TASK_REQUEST: 'Task Name' when you need the user to start a task.
- LOG_HABIT: 'habit description' when you detect a behavior pattern to track.
- TRACK_EXPENSE: amount | description when spending is mentioned.`
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

      const moodMatch = aiContent.match(/MOOD:\s*['"]?(DISAPPOINTED|HOPEFUL|DOMINATOR|NEUTRAL)['"]?/i);
      if (moodMatch) {
        setBotMood(moodMatch[1].toUpperCase() as 'NEUTRAL' | 'DISAPPOINTED' | 'HOPEFUL' | 'DOMINATOR');
      }

      const aiMessage: Message = {
        role: 'assistant',
        content: aiContent
          .replace(/TASK_REQUEST: ['"].+?['"]/gi, '')
          .replace(/MOOD:\s*['"]?(DISAPPOINTED|HOPEFUL|DOMINATOR|NEUTRAL)['"]?/gi, '')
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
          const newHabits = [newIssue, ...(prefs.habitNotes || [])];
          updatePreferences({ habitNotes: newHabits });
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
    const nextActiveTasks = [newTask, ...activeTasks];
    setActiveTasks(nextActiveTasks);
    persistChatSnapshot({ messages: updatedMessages, activeTasks: nextActiveTasks });
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
    const nextActiveTasks = [newTask, ...activeTasks];
    setActiveTasks(nextActiveTasks);
    persistChatSnapshot({ activeTasks: nextActiveTasks });

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
    const timestamp = Date.now();
    const nextActiveTasks: ActiveTask[] = activeTasks.map(t => {
      if (t.id === taskId) {
        if (t.status === 'RUNNING') {
          const activeNow = timestamp - (t.lastStartedAt || t.startTime || timestamp);
          return {
            ...t,
            status: 'PAUSED',
            totalActiveTime: (t.totalActiveTime || 0) + (activeNow > 0 ? activeNow : 0),
            lastPausedAt: timestamp
          };
        }
        const pausedNow = timestamp - (t.lastPausedAt || t.startTime || timestamp);
        return {
          ...t,
          status: 'RUNNING',
          totalPausedTime: (t.totalPausedTime || 0) + (pausedNow > 0 ? pausedNow : 0),
          lastStartedAt: timestamp
        };
      }
      return t;
    });
    setActiveTasks(nextActiveTasks);
    persistChatSnapshot({ activeTasks: nextActiveTasks });
  };

  const closeTask = (taskId: string) => {
    const task = activeTasks.find(t => t.id === taskId);
    if (!task) return;
    const timestamp = Date.now();
    const finalActiveTime = task.status === 'RUNNING'
      ? (task.totalActiveTime || 0) + Math.max(0, timestamp - (task.lastStartedAt || task.startTime || timestamp))
      : (task.totalActiveTime || 0);
    const finalPausedTime = task.status === 'PAUSED'
      ? (task.totalPausedTime || 0) + Math.max(0, timestamp - (task.lastPausedAt || task.startTime || timestamp))
      : (task.totalPausedTime || 0);

    const completionMessage: Message = {
      role: 'assistant',
      content: `How did "${task.name}" go? Share your reflection. If you abandoned or switched tasks, explain what triggered it.`,
      completedMission: {
        name: task.name,
        startTime: task.startTime,
        endTime: timestamp,
        activeTime: finalActiveTime,
        pausedTime: finalPausedTime,
        notes: task.notes || []
      },
      timestamp: timestamp
    };

    const updatedMessages = [...messages, completionMessage];
    const updatedCompleted = [
      ...(completedTasks || []),
      {
        name: task.name,
        activeTime: finalActiveTime,
        pausedTime: finalPausedTime,
        finishedAt: timestamp,
        abandonmentReason: '',
        notes: task.notes
      }
    ];
    const remaining = activeTasks.filter(t => t.id !== taskId);

    setMessages(updatedMessages);
    setCompletedTasks(updatedCompleted);
    setActiveTasks(remaining);
    setNoteDrafts(prev => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    persistChatSnapshot({ messages: updatedMessages, completedTasks: updatedCompleted, activeTasks: remaining });
  };

  const addTaskNote = (taskId: string, text: string) => {
    if (!text.trim()) return;
    const nextActiveTasks = activeTasks.map(t => {
      if (t.id === taskId) {
        const newNote = { text, timestamp: Date.now() };
        return { ...t, notes: [...(t.notes || []), newNote] };
      }
      return t;
    });
    setActiveTasks(nextActiveTasks);
    persistChatSnapshot({ activeTasks: nextActiveTasks });
  };

  const rateCompletedMission = (messageIndex: number, taskName: string, rating: number) => {
    // update message
    const newMessages = [...messages];
    if (newMessages[messageIndex].completedMission) {
      newMessages[messageIndex].completedMission = {
        ...newMessages[messageIndex].completedMission,
        rating
      };
      setMessages(newMessages);
    }
    // update completedTasks array list
    setCompletedTasks(prev => {
        if (!prev) return prev;
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].name === taskName) {
                updated[i] = { ...updated[i], rating };
                break;
            }
        }
        return updated;
    });
  };

  const toggleTodoWithRecurrence = (id: string) => {
    setTodos(prev => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      return prev.map(t => {
        if (t.id !== id) return t;
        const recType = t.recurrence?.type;
        if (recType && recType !== 'once') {
          let newVisibility = t.visibility;
          if (t.visibility?.type === 'seasonal' && t.visibility.every_months) {
            newVisibility = {
              ...t.visibility,
              next_show: getNextSeasonalDate(t.visibility.every_months)
            };
          }
          return {
            ...t,
            last_completed: todayStr,
            completed: false,
            visibility: newVisibility
          };
        }
        return { ...t, completed: !t.completed };
      });
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

    // Load today from cloud (must include userId) and carry over tasks if today's list is empty
    const todayChat = user?.id ? await cloudStorage.getChat(today, user.id) : null;
    const defaults = { date: today, messages: [], status: 'OPEN' as const, activeTasks: [], distractions: [], todos: [], dailies: [], expenses: [] };
    const carryTodos = todos.filter(t => !t.completed);
    const carryDailies = dailies.map(d => ({ ...d, completed: false }));
    const seeded = { ...defaults, ...(todayChat || {}) };
    const mergedTodos = (todayChat?.todos?.length ?? 0) > 0 ? todayChat!.todos : carryTodos;
    const mergedDailies = (todayChat?.dailies?.length ?? 0) > 0 ? todayChat!.dailies : carryDailies;
    const base = { ...seeded, todos: mergedTodos, dailies: mergedDailies };

    const usedCarryTodos = (!todayChat || (todayChat?.todos?.length ?? 0) === 0) && carryTodos.length > 0;
    const usedCarryDailies = (!todayChat || (todayChat?.dailies?.length ?? 0) === 0) && carryDailies.length > 0;

    setMessages(base.messages);
    setChatStatus(base.status);
    setActiveTasks(base.activeTasks || []);
    setDistractions(base.distractions || []);
    setBotMood((base as typeof todayChat & { botMood?: string })?.botMood as typeof botMood || 'NEUTRAL');
    setTodos(filterTasksForToday(base.todos || []));
    setDailies(base.dailies || []);
    setCompletedTasks((base as typeof todayChat)?.completedTasks || []);
    setExpenses(base.expenses || []);
    if (!todayChat || usedCarryTodos || usedCarryDailies) await cloudStorage.saveChat(today, base, user?.id || undefined, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const triggerStartMission = () => {
    setLiveMissionOpen(prev => !prev);
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
    <div className="chat-page">
      <div className="bg-mesh"></div>

      <div className="chat-container">
        <header className="chat-header" style={{ zIndex: 5000, position: 'relative' }}>

          <div className="chat-header__left" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
          </div>

          <div className="nav-center-wrapper desktop-only" style={{ display: 'flex', justifyContent: 'center' }}>
            <NavigationBar />
          </div>

          <div className="header-controls" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div className="lux-start-wrap" ref={liveMissionAnchorRef}>
                <button
                  onClick={triggerStartMission}
                  className="lux-start-btn"
                  aria-label="Start a new mission"
                >
                  <span className="lux-start-icon" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="6 4 20 12 6 20 6 4" />
                    </svg>
                  </span>
                  <span className="lux-start-label">START MISSION</span>
                </button>
                <LiveMissionLauncher
                  open={liveMissionOpen}
                  onClose={() => setLiveMissionOpen(false)}
                  onLaunch={startManualTask}
                  anchorRef={liveMissionAnchorRef}
                />
              </div>
              {/* Profile dropdown */}
              <div className="profile-dropdown-wrapper" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '6px 14px', borderRadius: '100px',
                    background: profileOpen ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(10px)', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    zIndex: 10000 
                  }}
                >
                  {currentPfp ? (
                    <Image 
                      src={currentPfp} 
                      alt="avatar" 
                      width={28}
                      height={28}
                      style={{ borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #10b981', flexShrink: 0 }} 
                    />
                  ) : (
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: '900', boxShadow: '0 2px 10px rgba(139, 92, 246, 0.3)', flexShrink: 0 }}>
                      {(globalPrefs?.name || user?.primaryEmailAddress?.emailAddress)?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <span className="mobile-hidden" style={{ fontSize: '0.75rem', color: 'white', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '800', letterSpacing: '0.02em' }}>
                    {displayName}
                  </span>
                  <svg className="mobile-hidden" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s', flexShrink: 0 }}>
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
              userName={globalPrefs?.name || 'Disciple'}
              userAvatar={globalPrefs?.pfp || undefined}
            />
          )}

          {/* ── AI Chat Tab ────────────────────────────────────── */}
          <div className="chat-layout-grid" style={{ display: liveTab ? 'none' : 'grid' }}>

            <MissionChecklist
              todos={todos}
              dailies={dailies}
              sidebarOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              onToggleTodo={(id: string) => toggleTodoWithRecurrence(id)}
              onToggleDaily={(id: string) => setDailies(prev => prev.map(d => d.id === id ? { ...d, completed: !d.completed } : d))}
              onReorderTodo={(newTodos: DailyChat['todos']) => setTodos(newTodos)}
              onReorderDaily={(newDailies: DailyChat['dailies']) => setDailies(newDailies)}
              onAddDaily={(text) => setDailies(prev => [...prev, {
                id: Date.now().toString(),
                text,
                completed: false,
                importance: 0,
                time_slot: 'anytime',
                time_slot_time: '',
                notes: '',
                tags: []
              }])}
              onEditDaily={(id, text) => setDailies(prev => prev.map(d => d.id === id ? { ...d, text } : d))}
              onDeleteDaily={(id) => setDailies(prev => prev.filter(d => d.id !== id))}
              onAddTodo={(text) => setTodos(prev => [...prev, {
                id: Date.now().toString(),
                text,
                completed: false,
                importance: 0,
                due_date: '',
                emergency_date: '',
                due_time: '',
                recurrence: { type: 'once' },
                visibility: { type: 'always' },
                tags: [],
                notes: '',
                snoozed_until: '',
                last_completed: ''
              }])}
              onEditTodo={(id, text) => setTodos(prev => prev.map(t => t.id === id ? { ...t, text } : t))}
              onDeleteTodo={(id) => setTodos(prev => prev.filter(t => t.id !== id))}
            />

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              maxHeight: '100%',
              overflow: 'hidden',
              background: 'transparent',
              flex: 1,
              position: 'relative'
            }}>

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

              <div className="chat-messages" ref={scrollContainerRef}>

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
                              {currentPfp ? (
                                <Image src={currentPfp} alt="pfp" className="pfp-icon" width={36} height={36} />
                              ) : (
                                <div className="pfp-icon" style={{ background: 'var(--accent)', opacity: 0.5 }}></div>
                              )}
                            </>
                          ) : (
                            <>
                              {activePersona?.avatar ? (
                                <Image
                                  src={activePersona.avatar}
                                  alt={`${activePersona.name} avatar`}
                                  className="pfp-icon"
                                  width={36}
                                  height={36}
                                />
                              ) : (
                                <div
                                  className="pfp-icon"
                                  style={{ background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}
                                >
                                  {activePersona?.icon || '🧘'}
                                </div>
                              )}
                              <span className="profile-name">{activePersona?.name || 'DISCIPLINIST'}</span>
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
                                {msg.completedMission.notes && msg.completedMission.notes.length > 0 && (
                                  <div className="mc-stat mc-wide" style={{ gap: '8px' }}>
                                    <span className="mc-stat-label">📔 SESSION NOTES</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      {msg.completedMission.notes.map((n: TaskNote, idx: number) => (
                                        <p key={idx} style={{ fontSize: '0.75rem', opacity: 0.9, margin: 0, lineHeight: '1.4' }}>• {n.text}</p>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <p className="mc-prompt">{msg.content}</p>
                              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(16,185,129,0.15)' }}>
                                <p style={{ fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.2em', color: '#10b981', opacity: 0.7, marginBottom: '0.5rem' }}>RATE YOUR PERFORMANCE</p>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {[1, 2, 3, 4, 5].map(star => (
                                    <button 
                                      key={star} 
                                      onClick={() => rateCompletedMission(i, msg.completedMission!.name, star)}
                                      style={{
                                        background: 'none', border: 'none', cursor: 'pointer', padding: '0',
                                        fontSize: '1.5rem', transition: 'all 0.2s',
                                        color: msg.completedMission!.rating && msg.completedMission!.rating >= star ? '#f59e0b' : 'rgba(255,255,255,0.2)',
                                        textShadow: msg.completedMission!.rating && msg.completedMission!.rating >= star ? '0 0 10px rgba(245, 158, 11, 0.4)' : 'none',
                                        transform: msg.completedMission!.rating && msg.completedMission!.rating >= star ? 'scale(1.1)' : 'scale(1)'
                                      }}
                                      title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                                    >
                                      ★
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : msg.role === 'assistant' ? (
                            <div className="chat-md chat-message-content">
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
                          <button className="edit-btn" onClick={() => startEdit(i, msg.content)} aria-label="Edit message">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}                      </>
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
                  const totalTime = activeTime + pausedTime;
                  const activePct = totalTime > 0
                    ? Math.round((activeTime / totalTime) * 100)
                    : (task.status === 'RUNNING' ? 100 : 0);
                  const startedAt = task.startTime
                    ? new Date(task.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '—';
                  const statusLabel = task.status === 'RUNNING' ? 'LIVE' : 'PAUSED';
                  const progressStyle = { '--active-pct': `${activePct}%` } as CSSProperties;

                  const statusIcon = task.status === 'RUNNING' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="6" y="4" width="4" height="16" fill="currentColor" />
                      <rect x="14" y="4" width="4" height="16" fill="currentColor" />
                    </svg>
                  );
                  return (
                    <div
                      key={task.id}
                      className={`active-task-card ${task.status === 'RUNNING' ? 'is-running' : 'is-paused'}`}
                      style={progressStyle}
                    >
                      <div className="active-task-top">
                        <div className="active-task-status">
                          <span className="active-task-dot" />
                          <span className="active-task-state">{statusLabel}</span>
                          <span className="active-task-started">Started {startedAt}</span>
                        </div>
                        <div className="active-task-actions">
                          <button onClick={() => toggleTask(task.id)} className="active-task-btn ghost">
                            {task.status === 'RUNNING' ? 'Pause' : 'Resume'}
                          </button>
                          <button onClick={() => closeTask(task.id)} className="active-task-btn solid">
                            Finish
                          </button>
                        </div>
                      </div>

                      <div className="active-task-main">
                        <div className="active-task-icon">{statusIcon}</div>
                        <div className="active-task-body">
                          <div className="active-task-title-row">
                            <p className="active-task-title">{task.name}</p>
                            <span className="active-task-total">{formatTime(totalTime, false)}</span>
                          </div>
                          <div className="active-task-metrics">
                            <div className="active-task-metric">
                              <span>Active</span>
                              <strong>{formatTime(activeTime, false)}</strong>
                            </div>
                            <div className="active-task-metric">
                              <span>Paused</span>
                              <strong>{formatTime(pausedTime, false)}</strong>
                            </div>
                            <div className="active-task-metric">
                              <span>Notes</span>
                              <strong>{(task.notes || []).length}</strong>
                            </div>
                          </div>
                          <div className="active-task-bar">
                            <div className="active-task-bar-fill" />
                          </div>
                        </div>
                      </div>

                      {(task.notes || []).length > 0 && (
                        <div className="active-task-notes">
                          {(task.notes || []).map((note, idx) => (
                            <div key={idx} className="active-task-note">
                              <p className="active-task-note-text">{note.text}</p>
                              <p className="active-task-note-time">
                                {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="active-task-input-row">
                        <input
                          type="text"
                          className="active-task-input"
                          placeholder="Add a note... (Enter to save)"
                          value={noteDrafts[task.id] || ''}
                          onChange={(e) => updateNoteDraft(task.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              submitTaskNote(task.id);
                            }
                          }}
                        />
                        <button
                          onClick={() => submitTaskNote(task.id)}
                          className="active-task-btn icon"
                          disabled={!noteDrafts[task.id]?.trim()}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Quick Preset Task Button */}
                {activeTasks.length > 0 && (
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <button
                      onClick={() => setShowPresetTasks(true)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.borderColor = 'var(--accent)';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      📋 Quick Add Preset Task
                    </button>
                  </div>
                )}

                {/* Preset Task Selector */}
                {activeTasks.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                    <button
                      onClick={() => setShowPresetTasks(true)}
                      style={{
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        padding: '1rem 2rem',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        marginBottom: '1rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      📋 Choose from Preset Tasks
                    </button>
                    <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: 0 }}>
                      Or type a custom task in the chat
                    </p>
                  </div>
                )}

                {/* Invisible anchor at the very bottom */}
                <div ref={bottomRef} style={{ height: '40px', flexShrink: 0 }} />
              </div>

              {/* Input area (AI chat only) */}
              {messages.length > 0 && (
                <div className="input-area">
                  <div className="input-wrapper">
                    {/* Scroll button embedded in input row for mobile */}
                    {showScrollBtn && (
                      <button
                        onClick={() => {
                          isUserScrolledUp.current = false;
                          setShowScrollBtn(false);
                          scrollToBottom('smooth');
                        }}
                        style={{
                          flexShrink: 0,
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'rgba(212,160,23,0.15)',
                          border: '1px solid rgba(212,160,23,0.35)',
                          color: '#d4a017',
                          fontSize: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          animation: 'fadeIn 0.2s ease',
                          marginRight: '-4px'
                        }}
                      >
                        ↓
                      </button>
                    )}
                    
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

            {/* Auto-generate record pill indicator */}
            {autoGenerating && (
              <div style={{
                position: 'fixed',
                bottom: '72px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 200,
                background: '#1a1500',
                border: '1px solid rgba(212,160,23,0.3)',
                borderRadius: '20px',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'rgba(212,160,23,0.8)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(10px)',
                pointerEvents: 'none'
              }}>
                <div style={{
                  width: '6px', height: '6px',
                  borderRadius: '50%',
                  background: '#d4a017',
                  animation: 'dot-pulse 1s infinite'
                }} />
                Generating yesterday&apos;s record...
              </div>
            )}

            </div>
            {/* ── closes AI Chat Tab wrapper ── */}
          </div>

        </div>


        <style jsx global>{`
                .profile-dropdown-wrapper { position: relative; }
                .profile-dropdown {
                  position: absolute;
                  top: calc(100% + 12px);
                  right: 0;
                  width: 260px;
                  background: #0d0d0f !important; /* Solid Dark Theme */
                  border: 2px solid rgba(255,255,255,0.18);
                  border-radius: 16px;
                  box-shadow: 0 30px 60px rgba(0,0,0,1), 0 0 40px rgba(0,0,0,0.6);
                  z-index: 99999 !important;
                  overflow: hidden;
                  opacity: 1 !important;
                  pointer-events: auto !important;
                  animation: slideIn 0.2s cubic-bezier(0, 0, 0.2, 1);
                }
                .profile-dropdown__header {
                  padding: 16px;
                  background: rgba(255,255,255,0.03);
                  border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .profile-dropdown__email {
                  font-size: 0.75rem;
                  color: rgba(255,255,255,0.4);
                  margin: 0;
                  font-weight: 500;
                  word-break: break-all;
                }
                .profile-dropdown__item {
                  width: 100%;
                  padding: 12px 16px;
                  display: flex;
                  align-items: center;
                  gap: 12px;
                  background: transparent;
                  border: none;
                  color: rgba(255,255,255,0.85);
                  font-size: 0.85rem;
                  font-weight: 700;
                  cursor: pointer;
                  transition: all 0.2s ease;
                  text-align: left;
                }
                .profile-dropdown__item:hover {
                  background: rgba(255,255,255,0.08);
                  color: white;
                }
                .profile-dropdown__item--danger { color: #ff5555; }
                .profile-dropdown__item--danger:hover { background: rgba(255,85,85,0.1); }
                
                @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
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

                @media (max-width: 768px) {
                    .chat-messages { 
                      padding: 0.75rem 0.6rem 250px !important; /* Safety padding for mobile fixed UI */
                      gap: 0.6rem !important; 
                      height: calc(100dvh - 60px) !important;
                      overflow-y: auto !important;
                      -webkit-overflow-scrolling: touch !important;
                  }
                  .chat-header {
                    position: sticky !important;
                    top: 0;
                    z-index: 5001 !important;
                    background: #0a0a0b !important; /* Opaque header on mobile */
                  }
                  .input-area {
                    z-index: 500 !important;
                    background: #0a0a0b !important;
                  }
                  .message-wrapper { 
                    width: 100% !important; 
                    padding: 4px 10px !important;
                    gap: 2px !important;
                  }
                  
                  /* Mobile AI Typography Tighter Density */
                  .chat-message-content p {
                    margin-bottom: 6px;
                    line-height: 1.55;
                  }
                  .chat-message-content ul,
                  .chat-message-content ol {
                    padding-left: 16px;
                    margin: 6px 0;
                  }
                  .chat-message-content li {
                    margin-bottom: 4px;
                    line-height: 1.5;
                  }
                  .chat-message-content h3,
                  .chat-message-content h4 {
                    margin: 8px 0 4px 0;
                    font-size: 13px;
                  }
                  .active-task-card { 
                    padding: 1.1rem !important;
                    margin: 0.75rem 0 1.4rem 0 !important;
                    gap: 0.9rem !important;
                  }
                  .active-task-main { flex-direction: column !important; align-items: flex-start !important; }
                  .active-task-icon { margin-bottom: -0.2rem !important; }
                  .active-task-actions { width: 100% !important; justify-content: space-between !important; }
                  .active-task-input-row { flex-direction: column !important; align-items: stretch !important; }
                  .active-task-input { 
                    font-size: 0.95rem !important; 
                    padding: 14px !important; 
                    background: rgba(0,0,0,0.3) !important;
                    border-color: rgba(255,255,255,0.1) !important;
                  }
                  .active-task-btn.icon { width: 100% !important; }
                  .gc-bubble { max-width: 94% !important; }
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

                /* Responsive Main Layout */
                .chat-layout-grid {
                  flex: 1;
                  height: 100%;
                  width: 100%;
                  overflow: hidden;
                  grid-template-columns: 1fr; /* Mobile default */
                  grid-template-rows: 1fr;
                }

                @media (min-width: 768px) {
                  .chat-layout-grid {
                    grid-template-columns: 300px 1fr; /* Desktop sidebar */
                  }
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
        <SettingsSidebar />
      </div>
      
      {/* Preset Task Selector Modal */}
      {showPresetTasks && (
        <PresetTaskSelector
          onTaskSelect={(taskName) => {
            startManualTask(taskName);
            setShowPresetTasks(false);
          }}
          onClose={() => setShowPresetTasks(false)}
        />
      )}
    </div>
  );
}
