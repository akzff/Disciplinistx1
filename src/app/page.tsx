'use client';

import { useState, useRef, useEffect } from 'react';
import { storage, Message, DailyChat, UserPreferences, ActiveTask, formatTime } from '@/lib/storage';
import Image from 'next/image';
import MissionsBoard from '@/components/MissionsBoard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cloudStorage } from '@/lib/cloudStorage';
import { useAuthContext } from '@/lib/AuthContext';
import { useData } from '@/lib/DataContext';
import { useUser } from '@clerk/nextjs';
import '@/lib/manualMigration';
import UniversalLayout from '@/components/UniversalLayout';

// Strip model's internal reasoning tags before displaying
function cleanBotMessage(text: string): string {
  // Simple approach to avoid regex issues with special characters
  let cleaned = text;
  
  // Remove thinking blocks
  const thinkStart = cleaned.indexOf('<thinking>');
  if (thinkStart !== -1) {
    const thinkEnd = cleaned.indexOf('</thinking>');
    if (thinkEnd !== -1) {
      cleaned = cleaned.substring(0, thinkStart) + cleaned.substring(thinkEnd + '</thinking>'.length);
    } else {
      cleaned = cleaned.substring(0, thinkStart);
    }
  }
  
  // Remove unfinished tags
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
  const [isInitialized, setIsInitialized] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { signOut } = useAuthContext();
  const { user } = useUser();
  const { allChats, preferences: globalPrefs, updatePreferences: updateContextPrefs, setLocalChat } = useData();
  const saveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isInitialized || !globalPrefs || !allChats) return;
    const init = async () => {
      setPreferences(globalPrefs);

      const today = storage.getCurrentDate();
      const prev = storage.getPreviousDate(today);
      const prevChat = allChats[prev];
      const todayChat = allChats[today];

      console.log('Data init:', { today, prev, prevChat: !!prevChat, todayChat: !!todayChat });
      console.log('Prev chat data:', prevChat ? {
        todos: prevChat.todos?.length || 0,
        dailies: prevChat.dailies?.length || 0,
        todosIncomplete: prevChat.todos?.filter(t => !t.completed).length || 0
      } : 'No prev chat');

      if (prevChat && prevChat.status === 'OPEN') {
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
          await cloudStorage.saveChat(today, base, user?.id || undefined);
          setLocalChat(today, base);
        }
      }

      setCurrentDate(today);
      setPreviousDate(prev);
      setIsPreviousDayOpen(!!prevChat && prevChat.status === 'OPEN');
      setIsInitialized(true);
    };
    init();
  }, [globalPrefs, allChats, user?.id, setLocalChat]);

  useEffect(() => {
    if (!activeDay || !isInitialized) return;
    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    saveDebounce.current = setTimeout(() => {
      const chatD = { messages, status: chatStatus, activeTasks, distractions, botMood, todos, dailies, completedTasks, expenses };
      cloudStorage.saveChat(activeDay, chatD, user?.id || undefined);
      setLocalChat(activeDay, chatD as DailyChat);
    }, 500);
    return () => { if (saveDebounce.current) clearTimeout(saveDebounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, chatStatus, activeDay, activeTasks, distractions, botMood, todos, dailies, completedTasks, expenses, isInitialized]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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
    const messagesToSend = overrideMessages || messages;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: textToSend.trim(),
      timestamp: Date.now()
    };

    const updatedMessages = [...messagesToSend, userMessage];
    setMessages(updatedMessages);
    if (!overrideInput) setInput('');
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
      const recentMessages = updatedMessages.slice(-8);
      
      const prompt = `You are a strict but supportive discipline coach. Your role is to help the user stay focused, motivated, and on track with their goals.

CURRENT SESSION:
- Date: ${currentDate}
- Mood: ${botMood}
- Chat Status: ${chatStatus}

STATUS_REPORT: 
- COMPLETED: ${completed}
- PENDING: ${pending}
- ACTIVE: ${activeTasks.length > 0 ? activeTasks.map(t => t.name).join(', ') : 'None'}
HABITS_LOG: ${preferences.habitNotes?.join(', ') || 'None'}
TIME: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}

USER_MESSAGE: ${textToSend}

Respond as a discipline coach. Be:
1. Direct and no-nonsense
2. Supportive but firm
3. Action-oriented
4. Brief but impactful
5. Focused on execution and results

Keep responses under 150 words. Use emojis sparingly for emphasis.`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          maxTokens: 3000,
          temperature: 0.7
        })
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      const botMessage: Message = {
        role: 'assistant',
        content: cleanBotMessage(data.content),
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, botMessage]);

      // Auto-detect task requests
      const taskMatch = textToSend.match(/start\s+(?:task\s+)?(.+)/i);
      if (taskMatch) {
        const taskName = taskMatch[1].trim();
        const newTask: ActiveTask = {
          id: Date.now().toString(),
          name: taskName,
          startTime: Date.now(),
          status: 'RUNNING',
          totalActiveTime: 0,
          totalPausedTime: 0,
          lastStartedAt: Date.now()
        };

        setMessages(prevMsgs => [...prevMsgs, botMessage, {
          role: 'assistant',
          content: `🔥 Task "${taskName}" started! Stay focused and execute with precision.`,
          timestamp: Date.now()
        }]);

        setActiveTasks([newTask, ...activeTasks]);
      }

    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error: Failed to process your request. Try again.',
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startManualTask = (name: string) => {
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
        content: '',
        timestamp: Date.now(),
        completedMission: {
          name: task.name,
          startTime: task.startTime,
          endTime: timestamp,
          activeTime: finalActiveTime,
          pausedTime: finalPausedTime,
        }
      }]);

      // Also emit a plain text fallback for compatibility
      setMessages(prevMsgs => [...prevMsgs, {
        role: 'assistant',
        content: `✅ Mission Complete: "${task.name}"\n⏱ Active: ${formatTime(finalActiveTime)} | ⏸ Paused: ${formatTime(finalPausedTime)}`,
        timestamp: Date.now()
      }]);

      // Add to completed tasks
      setCompletedTasks(prev => [...prev, {
        name: task.name,
        activeTime: finalActiveTime,
        pausedTime: finalPausedTime,
        finishedAt: timestamp,
        abandonmentReason: '' // Will be filled when user responds
      }]);

      return prev.filter(t => t.id !== taskId);
    });
  };

  const startMyDay = () => {
    const today = storage.getCurrentDate();
    setActiveDay(today);
    setChatStatus('OPEN');
    setIsPreviousDayOpen(false);
    setHideOverlay(false);
    const newChat: DailyChat = {
      date: today,
      messages: [{
        role: 'assistant',
        content: `🌅 Good morning, ${preferences.name || 'Disciple'}!\n\nToday is a fresh start. Your discipline from yesterday builds momentum for today.\n\nWhat's your primary mission today? Be specific and actionable.\n\nRemember: Excellence is not an act, but a habit.`,
        timestamp: Date.now()
      }],
      status: 'OPEN',
      activeTasks: [],
      distractions: [],
      todos: [],
      dailies: [],
      expenses: []
    };
    setMessages(newChat.messages);
    cloudStorage.saveChat(today, newChat, user?.id || undefined);
    setLocalChat(today, newChat);
  };

  const closePreviousDay = async () => {
    if (!previousDate) return;
    const prevChat = allChats[previousDate];
    if (!prevChat) return;

    const updatedChat = { ...prevChat, status: 'CLOSED' as const };
    await cloudStorage.saveChat(previousDate, updatedChat, user?.id || undefined);
    setLocalChat(previousDate, updatedChat);
    setIsPreviousDayOpen(false);
    setHideOverlay(false);

    // Start today
    startMyDay();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const saveEdit = () => {
    if (editingIndex === null || !editValue.trim()) return;
    const updatedMessages = messages.map((msg, i) => 
      i === editingIndex ? { ...msg, content: editValue.trim() } : msg
    );
    setMessages(updatedMessages);
    setEditingIndex(null);
    setEditValue('');
  };

  // Update now every second for active task timers
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const taskSidebarProps = {
    todos,
    dailies,
    onToggleTodo: (id: string) => setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t)),
    onToggleDaily: (id: string) => setDailies(prev => prev.map(d => d.id === id ? { ...d, completed: !d.completed } : d)),
    onReorderTodo: (newTodos: DailyChat['todos']) => setTodos(newTodos),
    onReorderDaily: (newDailies: DailyChat['dailies']) => setDailies(newDailies),
    onStartLiveMission: startManualTask
  };

  return (
    <UniversalLayout 
      showTaskSidebar={true}
      showNavigationBar={false}
      taskSidebarProps={taskSidebarProps}
    >
      <div className="chat-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Chat Header */}
        <header className="chat-header">
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.2rem', fontWeight: '900', letterSpacing: '0.1em', color: 'var(--accent)' }}>DISCIPLINIST</h1>
            <p style={{ fontSize: '0.7rem', opacity: 0.6 }}>AI DISCIPLINE COACH</p>
          </div>
        </header>

        {/* Previous Day Overlay */}
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

        {/* Chat Messages */}
        <div className="chat-messages" ref={scrollRef}>
          {isInitialized && messages.length === 0 && (
            <div className="start-day-wrapper">
              <div style={{ fontSize: '4rem', filter: 'drop-shadow(0 0 20px var(--accent-glow))' }}>🌅</div>
              <div>
                <h2 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '0.5rem' }}>A New Day Begins</h2>
                <p style={{ opacity: 0.6 }}>Your day starts fresh. What will you do today?</p>
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
                <div className={`message ${msg.role}`} style={{ maxWidth: '80%' }}>
                  {msg.completedMission ? (
                    <div className="mission-completed-card">
                      <div className="mc-header">
                        <div className="mc-icon">🏆</div>
                        <div className="mc-title">MISSION COMPLETE</div>
                      </div>
                      <div className="mc-content">
                        <div className="mc-task-name">{msg.completedMission.name}</div>
                        <div className="mc-stats">
                          <div className="mc-stat">
                            <span className="mc-stat-label">⏱ ACTIVE TIME</span>
                            <span className="mc-stat-value">{formatTime(msg.completedMission.activeTime)}</span>
                          </div>
                          <div className="mc-stat">
                            <span className="mc-stat-label">⏸ PAUSED TIME</span>
                            <span className="mc-stat-value">{formatTime(msg.completedMission.pausedTime)}</span>
                          </div>
                          <div className="mc-stat mc-wide">
                            <span className="mc-stat-label">⏱ TOTAL DURATION</span>
                            <span className="mc-stat-value">{formatTime(msg.completedMission.activeTime + msg.completedMission.pausedTime)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  )}
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {msg.role === 'user' && (
                      <button 
                        className="edit-btn"
                        onClick={() => {
                          setEditingIndex(i);
                          setEditValue(msg.content);
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
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

        {/* Chat Input */}
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
          </div>
          <button className="send-button" onClick={() => handleSend()} disabled={!input.trim() || isLoading}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          </button>
        </div>
      </div>

      <style jsx>{`
        .mission-completed-card {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(34, 197, 94, 0.05));
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 12px;
          padding: 1rem;
          margin: 1rem 0;
          box-shadow: 0 4px 20px rgba(16, 185, 129, 0.15);
        }
        .mc-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 1rem;
        }
        .mc-icon {
          font-size: 2rem;
        }
        .mc-title {
          font-size: 0.9rem;
          font-weight: 800;
          color: #10b981;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .mc-task-name {
          font-size: 1.1rem;
          font-weight: 700;
          margin-bottom: 0.8rem;
        }
        .mc-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
        }
        .mc-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
        }
        .mc-stat.mc-wide {
          grid-column: span 2;
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
    </UniversalLayout>
  );
}
