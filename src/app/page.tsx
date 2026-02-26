'use client';

import { useState, useRef, useEffect } from 'react';
import { storage, Message, DailyChat, UserPreferences, ActiveTask } from '@/lib/storage';
import Link from 'next/link';
import MissionsBoard from '@/components/MissionsBoard';
import MissionChecklist from '@/components/MissionChecklist';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    habitNotes: []
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

  const scrollRef = useRef<HTMLDivElement>(null);

  const apiConfig = {
    model: 'qwen/qwen3-32b',
    provider: 'Groq',
    temperature: 0.7,
    maxTokens: 2000,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions'
  };

  useEffect(() => {
    const today = storage.getCurrentDate();
    const prev = storage.getPreviousDay(today);
    const prevChat = storage.getChat(prev);
    const todayChat = storage.getChat(today);
    const savedPrefs = storage.getUserPreferences();

    setCurrentDate(today);
    setPreviousDate(prev);
    setPreferences(savedPrefs);

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
      const chatToLoad = todayChat || storage.initializeNewDay(today);
      setMessages(chatToLoad.messages);
      setChatStatus(chatToLoad.status);
      setBotMood(chatToLoad.botMood || 'NEUTRAL');
      setActiveTasks(chatToLoad.activeTasks || []);
      setDistractions(chatToLoad.distractions || []);
      setTodos(chatToLoad.todos || []);
      setDailies(chatToLoad.dailies || []);
      setCompletedTasks(chatToLoad.completedTasks || []);
      setExpenses(chatToLoad.expenses || []);
    }
  }, []);

  useEffect(() => {
    if (activeDay) {
      storage.saveChat(activeDay, { messages, status: chatStatus, activeTasks, distractions, botMood, todos, dailies, completedTasks, expenses });
    }
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
        setBotMood(moodMatch[1].toUpperCase() as any);
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

      const durationMin = Math.floor(finalActiveTime / 60000);
      const durationSec = Math.floor((finalActiveTime % 60000) / 1000);
      const pausedMin = Math.floor(finalPausedTime / 60000);

      const closeMsg = `✅ Mission complete: "${task.name}". Active: ${durationMin}m ${durationSec}s | Paused: ${pausedMin}m. How did it go?`;
      setMessages(prevMsgs => [...prevMsgs, { role: 'assistant', content: closeMsg }]);

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

  const closePreviousDay = () => {
    storage.closeChat(activeDay);
    setIsPreviousDayOpen(false);
    const today = storage.getCurrentDate();
    setActiveDay(today);
    const todayChat = storage.getChat(today) || storage.initializeNewDay(today);

    setMessages(todayChat.messages);
    setChatStatus(todayChat.status);
    setActiveTasks(todayChat.activeTasks || []);
    setDistractions(todayChat.distractions || []);
    setBotMood(todayChat.botMood || 'NEUTRAL');
    setTodos(todayChat.todos || []);
    setDailies(todayChat.dailies || []);
    setCompletedTasks(todayChat.completedTasks || []);
    setExpenses(todayChat.expenses || []);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const savePreferences = (val: string) => {
    updateProfile({ dayVision: val });
  };

  const updateProfile = (updates: Partial<UserPreferences>) => {
    const newPrefs = { ...preferences, ...updates };
    setPreferences(newPrefs);
    storage.saveUserPreferences(newPrefs);
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
            <p style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: '500' }}>{activeDay === currentDate ? 'TODAY' : 'YESTERDAY'}'S SESSION</p>
          </div>

          <nav style={{ display: 'flex', gap: '0.5rem', marginRight: '1rem' }}>
            <Link href="/" className="nav-link active">Chat</Link>
            <button
              onClick={() => setShowMissions(true)}
              className="nav-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Missions
            </button>
            <Link href="/expenses" className="nav-link">Expenses</Link>
            <Link href="/records" className="nav-link">Records</Link>
          </nav>

          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{ background: 'var(--surface)', border: 'none', color: 'white', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </header>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

          <MissionChecklist
            todos={todos}
            dailies={dailies}
            expenses={expenses || []}
            onToggleTodo={(id) => setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t))}
            onToggleDaily={(id) => setDailies(prev => prev.map(d => d.id === id ? { ...d, completed: !d.completed } : d))}
            onReorderTodo={(newTodos) => setTodos(newTodos)}
            onReorderDaily={(newDailies) => setDailies(newDailies)}
            onStartLiveMission={startManualTask}
            onAddExpense={(amount, text) => setExpenses(prev => [...(prev || []), { id: Date.now().toString(), amount, text }])}
            onRemoveExpense={(id) => setExpenses(prev => (prev || []).filter(e => e.id !== id))}
          />

          {isPreviousDayOpen && (
            <div className="overlay">
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
              <h2 style={{ marginBottom: '1rem' }}>Unfinished Business</h2>
              <p style={{ maxWidth: '400px', opacity: 0.8, marginBottom: '2rem' }}>
                You haven't told the bot how you spent the end of <b>{previousDate}</b>.
                Complete the details before starting today.
              </p>
              <button className="start-day-btn" style={{ fontSize: '1rem', padding: '1rem 2rem' }} onClick={closePreviousDay}>
                I've Told Everything
              </button>
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
                      {msg.role === 'assistant' ? (
                        <div className="chat-md">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent)', display: 'block', marginBottom: '8px' }}>MENTORING INTENSITY</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 3].map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => updateProfile({ mentorLevel: lvl as any })}
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
