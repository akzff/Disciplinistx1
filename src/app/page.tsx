'use client';

import { useState, useRef, useEffect } from 'react';
import { storage, Message, DailyChat, UserPreferences, ActiveTask } from '@/lib/storage';
import Link from 'next/link';
import MissionsBoard from '@/components/MissionsBoard';
import MissionChecklist from '@/components/MissionChecklist';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NavigationBar } from '@/components/NavigationBar';
import { cloudStorage } from '@/lib/cloudStorage';
import { useAuth } from '@/lib/AuthContext';

// Strip model's internal reasoning tags before displaying
function cleanBotMessage(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .trim();
}


export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentDate, setCurrentDate] = useState('');
  const [chatStatus, setChatStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [isPreviousDayOpen, setIsPreviousDayOpen] = useState(false);
  const [hideOverlay, setHideOverlay] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  const [previousDate, setPreviousDate] = useState('');
  const [activeDay, setActiveDay] = useState('');
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const saveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const init = async () => {
      const today = storage.getCurrentDate();
      const prev = storage.getPreviousDay(today);

      setCurrentDate(today);
      setPreviousDate(prev);

      // Load preferences from cloud, fall back to localStorage
      const cloudPrefs = await cloudStorage.getPreferences();
      const savedPrefs = cloudPrefs || storage.getUserPreferences();
      setPreferences(savedPrefs);

      // Load chats from cloud
      const prevChat = await cloudStorage.getChat(prev);
      const todayChat = await cloudStorage.getChat(today);

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
        // If today doesn't exist in cloud but yesterday did, carry over undone todos/dailies
        const base = todayChat || (prevChat ? {
          ...defaults,
          todos: prevChat.todos?.filter(t => !t.completed) || [],
          dailies: prevChat.dailies?.map(d => ({ ...d, completed: false })) || []
        } : defaults);
        setMessages(base.messages);
        setChatStatus(base.status);
        setBotMood((base as typeof todayChat & { botMood?: string })?.botMood as typeof botMood || 'NEUTRAL');
        setActiveTasks(base.activeTasks || []);
        setDistractions(base.distractions || []);
        setTodos(base.todos || []);
        setDailies(base.dailies || []);
        setCompletedTasks((base as typeof todayChat)?.completedTasks || []);
        setExpenses(base.expenses || []);
        if (!todayChat) await cloudStorage.saveChat(today, base);
      }
    };
    init();
  }, []);

  // Debounced cloud save (500ms) to avoid hammering Supabase on every keystroke
  useEffect(() => {
    if (!activeDay) return;
    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    saveDebounce.current = setTimeout(() => {
      cloudStorage.saveChat(activeDay, { messages, status: chatStatus, activeTasks, distractions, botMood, todos, dailies, completedTasks, expenses });
    }, 500);
    return () => { if (saveDebounce.current) clearTimeout(saveDebounce.current); };
  }, [messages, chatStatus, activeDay, activeTasks, distractions, botMood, todos, dailies, completedTasks, expenses]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async (overrideInput?: string, overrideMessages?: Message[]) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || isLoading) return;

    // Cleanup pending task requests from previous messages
    const cleanedMessages = (overrideMessages || messages).map(msg => {
      if (msg.taskRequest?.status === 'PENDING') {
        return { ...msg, taskRequest: { ...msg.taskRequest, status: 'IGNORED' as const } };
      }
      return msg;
    });

    const userMessage: Message = { role: 'user', content: textToSend };
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
      const contextMessages = newMessages.slice(-8);

      // Only send Bio on start or if habits are few to save tokens
      const habitSummary = preferences.habitNotes.slice(0, 3).map(h => h.issue).join(', ');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: contextMessages,
          model: preferences.selectedModel,
          systemPrompt: `You are Disciplinist, a ruthless discipline coach.
                    USER: ${preferences.name}
                    AMBITION: ${preferences.ambition}
                    VISION: ${preferences.dailyModel}
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
                    - INTENSITY: ${preferences.mentorLevel === 1 ? 'Novice/Supportive' : preferences.mentorLevel === 2 ? 'Elite/Strict' : 'Beast/Ruthless'}.
                    - Level 3 (Beast) requirement: Minimum words, maximum pressure, no mercy.
                    - Bullet points only. Max 3 sentences. 
                    - TRACK_EXPENSE: amount | description (Use if user mentions spending money)
                    - MOOD: 'HOPEFUL|DISAPPOINTED|DOMINATOR|NEUTRAL' (End with mood)
                    - Level: ${preferences.mentorLevel} (1=Mid, 2=High, 3=Max)`
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
        taskRequest: taskReqData
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
        content: `How did "${task.name}" go? Share your reflection.`,
        completedMission: {
          name: task.name,
          startTime: task.startTime,
          endTime: timestamp,
          activeTime: finalActiveTime,
          pausedTime: finalPausedTime,
        }
      }]);

      setCompletedTasks(prevCompleted => [
        ...(prevCompleted || []),
        {
          name: task.name,
          activeTime: finalActiveTime,
          pausedTime: finalPausedTime,
          finishedAt: timestamp
        }
      ]);

      return prev.filter(t => t.id !== taskId);
    });
  };

  const startMyDay = () => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const greeting = `Namaste. It is ${time}. You are awake. How did you spend your time since last night? Give me a rough idea so we can begin your mission for today.`;
    setMessages([{ role: 'assistant', content: greeting }]);
    setChatStatus('OPEN');
  };

  const closePreviousDay = async () => {
    await cloudStorage.closeChat(activeDay);
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
    if (!todayChat) await cloudStorage.saveChat(today, base);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const updateProfile = (updates: Partial<UserPreferences>) => {
    const newPrefs = { ...preferences, ...updates };
    setPreferences(newPrefs);
    cloudStorage.savePreferences(newPrefs);
  };

  const handlePfpUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      updateProfile({ pfp: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <main>
      <div className="bg-mesh"></div>

      <div className="chat-container">
        <header className="chat-header">
          <div className="status-indicator" style={{
            background: botMood === 'DISAPPOINTED' ? '#ef4444' : botMood === 'HOPEFUL' ? '#10b981' : botMood === 'DOMINATOR' ? '#8b5cf6' : '#6b7280',
            boxShadow: `0 0 10px ${botMood === 'DISAPPOINTED' ? '#ef4444' : botMood === 'HOPEFUL' ? '#10b981' : botMood === 'DOMINATOR' ? '#8b5cf6' : '#6b7280'}`
          }}></div>
          {/* Mobile sidebar toggle — hidden on desktop via CSS */}
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(v => !v)}
            style={{ display: 'none', background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
            aria-label="Open mission panel"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.1rem', fontWeight: '800', letterSpacing: '0.05em', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              DISCIPLINIST
              <span style={{
                fontSize: '0.6rem',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.1)',
                opacity: 0.6,
                fontWeight: '600'
              }}>
                {botMood}
              </span>
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: '500', margin: 0 }}>{activeDay === currentDate ? 'TODAY' : 'YESTERDAY'}&apos;S SESSION</p>
              {isPreviousDayOpen && hideOverlay && (
                <button
                  onClick={closePreviousDay}
                  style={{ fontSize: '0.65rem', padding: '4px 12px', borderRadius: '100px', border: '1px solid var(--accent)', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent)', cursor: 'pointer', fontWeight: '800' }}>
                  FINISH YESTERDAY
                </button>
              )}
            </div>
          </div>

          <div className="header-controls" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <NavigationBar />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowMissions(true)}
                style={{
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(168, 85, 247, 0.1))',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  color: '#d8b4fe',
                  padding: '8px 16px',
                  borderRadius: '100px',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  fontWeight: '900',
                  letterSpacing: '0.05em',
                  boxShadow: '0 4px 15px rgba(139, 92, 246, 0.1)',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase'
                }}
              >
                Missions
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'white', padding: '8px', borderRadius: '100px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>

              {/* User badge + sign out */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '100px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '900' }}>
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: '0.6rem', opacity: 0.5, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</span>
                <button
                  onClick={signOut}
                  title="Sign Out"
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '0.6rem', padding: '2px 4px', borderRadius: '4px' }}
                >
                  ⏻
                </button>
              </div>
            </div>
          </div>
        </header>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

          {/* Mobile backdrop — closes sidebar when tapped */}
          {sidebarOpen && (
            <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
          )}

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
          />

          {isPreviousDayOpen && !hideOverlay && (
            <div className="overlay">
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
              <h2 style={{ marginBottom: '1rem' }}>Unfinished Business</h2>
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
            {messages.length === 0 && (
              <div className="start-day-wrapper">
                <div style={{ fontSize: '4rem', filter: 'drop-shadow(0 0 20px var(--accent-glow))' }}>🌅</div>
                <div>
                  <h2 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '0.5rem' }}>A New Cycle Begins</h2>
                  <p style={{ opacity: 0.6 }}>Your path today is yet to be written.</p>
                </div>
                <button className="start-day-btn" onClick={startMyDay}>
                  Start My Day
                </button>
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
                          <span className="profile-name">{preferences.name}</span>
                          {preferences.pfp ? (
                            <img src={preferences.pfp} alt="pfp" className="pfp-icon" />
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
                              <p className="mc-label">MISSION COMPLETE</p>
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
                              <span className="mc-stat-value">{Math.floor(msg.completedMission.activeTime / 60000)}m {Math.floor((msg.completedMission.activeTime % 60000) / 1000)}s</span>
                            </div>
                            <div className="mc-stat">
                              <span className="mc-stat-label">⏸ PAUSED TIME</span>
                              <span className="mc-stat-value">{Math.floor(msg.completedMission.pausedTime / 60000)}m {Math.floor((msg.completedMission.pausedTime % 60000) / 1000)}s</span>
                            </div>
                            <div className="mc-stat mc-wide">
                              <span className="mc-stat-label">⏱ TOTAL DURATION</span>
                              <span className="mc-stat-value">{Math.floor((msg.completedMission.endTime - msg.completedMission.startTime) / 60000)}m {Math.floor(((msg.completedMission.endTime - msg.completedMission.startTime) % 60000) / 1000)}s</span>
                            </div>
                          </div>
                          <p className="mc-prompt">{msg.content}</p>
                        </div>
                      ) : msg.role === 'assistant' ? (
                        <div className="chat-md">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              img: ({ node, ...props }) => <img {...props} style={{ maxWidth: '100%', borderRadius: '12px', marginTop: '10px' }} alt="AI generated" />,
                              a: ({ node, ...props }) => {
                                const isImage = props.href?.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i);
                                if (isImage) {
                                  return <img src={props.href} style={{ maxWidth: '100%', borderRadius: '12px', marginTop: '10px', display: 'block' }} alt="AI generated" />;
                                }
                                return <a {...props} target="_blank" rel="noopener noreferrer" />;
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
                          <h4>Start Mission?</h4>
                          <p>{msg.taskRequest.name}</p>
                          <button className="approve-btn" onClick={() => approveTask(i)}>Approve Mission</button>
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
                    <p style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: '700', textTransform: 'uppercase' }}>Active Mission</p>
                    <p style={{ fontWeight: '800' }}>{task.name}</p>
                    <p style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '2px' }}>
                      Active: {Math.floor(activeTime / 60000)}m {Math.floor((activeTime % 60000) / 1000)}s | Paused: {Math.floor(pausedTime / 60000)}m {Math.floor((pausedTime % 60000) / 1000)}s
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

          {showSettings && (
            <div className="settings-sidebar" style={{
              width: '320px',
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(30px)',
              borderLeft: '1px solid var(--border)',
              padding: '1.5rem',
              overflowY: 'auto',
              animation: 'slideIn 0.3s ease-out',
              zIndex: 10
            }}>
              <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem', opacity: 0.7 }}>Your Identity</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="setting-item" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ position: 'relative' }}>
                    {preferences.pfp ? (
                      <img src={preferences.pfp} alt="pfp" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>👤</div>
                    )}
                    <label className="pfp-upload-btn" style={{ position: 'absolute', bottom: -5, right: -5, width: '24px', height: '24px', padding: 0, borderRadius: '50%' }}>
                      <input type="file" hidden onChange={handlePfpUpload} accept="image/*" />
                      <span style={{ fontSize: '0.6rem' }}>+</span>
                    </label>
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      className="settings-input"
                      style={{ marginBottom: '8px', fontSize: '1rem', fontWeight: '900' }}
                      placeholder="Your Name"
                      value={preferences.name}
                      onChange={(e) => updateProfile({ name: e.target.value })}
                    />
                    <input
                      className="settings-input"
                      style={{ fontSize: '0.75rem', opacity: 0.6 }}
                      placeholder="Add a bio..."
                      value={preferences.bio}
                      onChange={(e) => updateProfile({ bio: e.target.value })}
                    />
                  </div>
                </div>

                <div className="setting-item">
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent)', display: 'block', marginBottom: '8px' }}>CORE MODEL</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { id: 'qwen/qwen3-32b', name: 'LITE-CORE (GROQ)', sub: 'Fast, efficient coaching' },
                      { id: 'gpt-4o', name: 'PRIME-CORE (POE)', sub: 'High intelligence reasoning' },
                      { id: 'gpt-image-1.5', name: 'VISION-CORE (POE)', sub: 'Image generation enabled' }
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => updateProfile({ selectedModel: m.id })}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px',
                          borderRadius: '8px',
                          border: preferences.selectedModel === m.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: preferences.selectedModel === m.id ? 'rgba(0,186,124,0.1)' : 'var(--surface)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontFamily: 'inherit'
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', fontWeight: '900', color: preferences.selectedModel === m.id ? 'var(--accent)' : 'white' }}>{m.name}</div>
                        <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>{m.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="setting-item">
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent)', display: 'block', marginBottom: '8px' }}>MENTORING INTENSITY</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 3].map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => updateProfile({ mentorLevel: lvl as 1 | 2 | 3 })}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          background: preferences.mentorLevel === lvl ? 'var(--accent)' : 'var(--surface)',
                          color: 'white',
                          fontSize: '0.7rem',
                          fontWeight: '800',
                          transition: 'all 0.2s',
                          cursor: 'pointer'
                        }}
                      >
                        {lvl === 1 ? 'NOVICE' : lvl === 2 ? 'ELITE' : 'BEAST'}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '8px' }}>
                    {preferences.mentorLevel === 1 && "Supportive coaching for starting out."}
                    {preferences.mentorLevel === 2 && "Strict discipline for high performance."}
                    {preferences.mentorLevel === 3 && "Ruthless intensity for the top 1%."}
                  </p>
                </div>

                <div className="setting-item">
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent)', display: 'block', marginBottom: '8px' }}>DETAILED DAILY MODEL</label>
                  <textarea
                    className="settings-input"
                    placeholder="Describe your perfect routine... (e.g., Deep work at 10am, Workout at 6pm)"
                    style={{ minHeight: '100px' }}
                    value={preferences.dailyModel}
                    onChange={(e) => updateProfile({ dailyModel: e.target.value })}
                  />
                </div>

                <div className="setting-item">
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#ffd700', display: 'block', marginBottom: '8px' }}>SOUL OF AMBITIONS</label>
                  <textarea
                    className="settings-input"
                    placeholder="Why are you working this hard? (e.g., 'I want to be the best' or 'To prove my worth')"
                    style={{ minHeight: '80px', borderLeft: '2px solid #ffd700' }}
                    value={preferences.ambition}
                    onChange={(e) => updateProfile({ ambition: e.target.value })}
                  />
                </div>
                <div className="setting-item">
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#ff4444', display: 'block', marginBottom: '8px' }}>IDENTIFIED HABITS</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {preferences.habitNotes.length === 0 && <p style={{ fontSize: '0.7rem', opacity: 0.5 }}>No deep patterns found yet.</p>}
                    {preferences.habitNotes.map(n => (
                      <div key={n.id} style={{ fontSize: '0.75rem', padding: '8px', background: 'rgba(255,0,0,0.1)', borderRadius: '6px', border: '1px solid rgba(255,0,0,0.2)' }}>
                        <p style={{ fontWeight: 'bold', color: '#ff8888' }}>{n.issue}</p>
                        <p style={{ opacity: 0.6, fontSize: '0.65rem' }}>Detected on {n.date}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        <div className="input-area">
          <div className="input-wrapper">
            <textarea
              placeholder="Commune with Disciplinist..."
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
          </div>
          <button className="send-button" onClick={() => handleSend()} disabled={!input.trim() || isLoading}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          </button>
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
      {showMissions && (
        <MissionsBoard
          chat={{ date: activeDay, messages, status: chatStatus, activeTasks, distractions, botMood, todos, dailies, completedTasks }}
          onUpdate={(updates) => {
            if (updates.todos) setTodos(updates.todos);
            if (updates.dailies) setDailies(updates.dailies);
          }}
          onClose={() => setShowMissions(false)}
        />
      )}
    </main>
  );
}
