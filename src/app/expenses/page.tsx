'use client';

import { useState, useEffect, useMemo } from 'react';
import { storage } from '@/lib/storage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NavigationBar } from '@/components/NavigationBar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { cloudStorage } from '@/lib/cloudStorage';
import { useData } from '@/lib/DataContext';
import { useAuthContext } from '@/lib/AuthContext';
import Image from 'next/image';

// Strip model's internal reasoning tags before displaying
function cleanBotMessage(text: string): string {
    let cleaned = text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

    if (cleaned.includes('<think>')) cleaned = cleaned.split('<think>')[0];
    if (cleaned.includes('<thinking>')) cleaned = cleaned.split('<thinking>')[0];

    return cleaned.trim();
}

export default function ExpensesPage() {
    const { allChats, setLocalChat, preferences } = useData();
    const { user, signOut } = useAuthContext();
    const displayName = preferences?.name || 'User';
    const currentPfp = preferences?.pfp;
    const [selectedDate, setSelectedDate] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDesc, setExpenseDesc] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editDesc, setEditDesc] = useState('');

    // Tab selection state
    const [activeTab, setActiveTab] = useState<'transactions' | 'analysis'>('transactions');

    // Suggestions states
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

    // Time Filtering states
    const [timePreset, setTimePreset] = useState<'7d' | '14d' | '30d' | '90d' | 'all' | 'custom'>('30d');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    // Graph interactions
    const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);

    // Item Metrics Search
    const [itemSearchQuery, setItemSearchQuery] = useState('');

    useEffect(() => {
        const today = storage.getCurrentDate();
        setSelectedDate(today);

        // Pre-fill custom dates with past 30 days
        const t = new Date();
        const tStr = t.toISOString().split('T')[0];
        setCustomEndDate(tStr);
        t.setDate(t.getDate() - 29);
        setCustomStartDate(t.toISOString().split('T')[0]);
    }, []);

    const allDates = useMemo(() => {
        return Object.keys(allChats).sort().reverse();
    }, [allChats]);

    const activeChat = useMemo(() => {
        return allChats[selectedDate] || null;
    }, [allChats, selectedDate]);

    const stats = useMemo(() => {
        const allExpenses: { amount: number; date: string }[] = [];
        Object.entries(allChats).forEach(([date, chat]) => {
            chat.expenses?.forEach(exp => allExpenses.push({ amount: exp.amount, date }));
        });

        const total = allExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const dayTotal = activeChat?.expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;

        return { total, dayTotal };
    }, [allChats, activeChat]);

    // 1. Smart Suggestion Database & Item Metrics
    const expenseHistory = useMemo(() => {
        const history: Record<string, { totalAmount: number; count: number; prices: number[]; dates: string[] }> = {};
        
        Object.entries(allChats).forEach(([date, chat]) => {
            chat.expenses?.forEach(exp => {
                const desc = exp.text.trim();
                if (!desc) return;
                const key = desc.toLowerCase();
                if (!history[key]) {
                    history[key] = { totalAmount: 0, count: 0, prices: [], dates: [] };
                }
                history[key].totalAmount += exp.amount;
                history[key].count += 1;
                history[key].prices.push(exp.amount);
                history[key].dates.push(date);
            });
        });

        return Object.entries(history).map(([key, data]) => {
            const priceCounts: Record<number, number> = {};
            let mostFrequentPrice = data.prices[0];
            let maxCount = 0;
            data.prices.forEach(p => {
                priceCounts[p] = (priceCounts[p] || 0) + 1;
                if (priceCounts[p] > maxCount) {
                    maxCount = priceCounts[p];
                    mostFrequentPrice = p;
                }
            });

            // Find the original casing of the item description
            let originalText = key;
            for (const chat of Object.values(allChats)) {
                const found = chat.expenses?.find(e => e.text.trim().toLowerCase() === key);
                if (found) {
                    originalText = found.text.trim();
                    break;
                }
            }

            const minPrice = Math.min(...data.prices);
            const maxPrice = Math.max(...data.prices);
            const averagePrice = data.totalAmount / data.count;
            const sortedDates = [...data.dates].sort();
            const lastBoughtDate = sortedDates[sortedDates.length - 1];

            return {
                text: originalText,
                price: mostFrequentPrice,
                frequency: data.count,
                totalSpent: data.totalAmount,
                averagePrice,
                minPrice,
                maxPrice,
                lastBoughtDate
            };
        }).sort((a, b) => b.frequency - a.frequency);
    }, [allChats]);

    const filteredSuggestions = useMemo(() => {
        if (!expenseDesc.trim()) {
            return expenseHistory.slice(0, 5);
        }
        const query = expenseDesc.toLowerCase();
        return expenseHistory
            .filter(item => item.text.toLowerCase().includes(query))
            .slice(0, 5);
    }, [expenseHistory, expenseDesc]);

    const selectSuggestion = (item: { text: string; price: number }) => {
        setExpenseDesc(item.text);
        setExpenseAmount(item.price.toString());
        setShowSuggestions(false);
    };

    const handleSuggestionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showSuggestions || filteredSuggestions.length === 0) {
            if (e.key === 'Enter') {
                handleAddExpense();
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveSuggestionIndex(prev => 
                prev < filteredSuggestions.length - 1 ? prev + 1 : 0
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveSuggestionIndex(prev => 
                prev > 0 ? prev - 1 : filteredSuggestions.length - 1
            );
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeSuggestionIndex >= 0 && activeSuggestionIndex < filteredSuggestions.length) {
                selectSuggestion(filteredSuggestions[activeSuggestionIndex]);
            } else {
                handleAddExpense();
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    // 2. Date limits calculations for range filter
    const dateRangeLimits = useMemo(() => {
        const todayStr = storage.getCurrentDate();
        const today = new Date(todayStr);
        
        let start = '';
        const end = todayStr;

        if (timePreset === '7d') {
            const d = new Date(today);
            d.setDate(today.getDate() - 6);
            start = d.toISOString().split('T')[0];
        } else if (timePreset === '14d') {
            const d = new Date(today);
            d.setDate(today.getDate() - 13);
            start = d.toISOString().split('T')[0];
        } else if (timePreset === '30d') {
            const d = new Date(today);
            d.setDate(today.getDate() - 29);
            start = d.toISOString().split('T')[0];
        } else if (timePreset === '90d') {
            const d = new Date(today);
            d.setDate(today.getDate() - 89);
            start = d.toISOString().split('T')[0];
        } else if (timePreset === 'custom') {
            start = customStartDate;
            return { start, end: customEndDate || todayStr };
        } else {
            start = '1970-01-01';
        }

        return { start, end };
    }, [timePreset, customStartDate, customEndDate]);

    // 3. Filtered expenses list for all analysis widgets
    const rangeExpenses = useMemo(() => {
        const list: { id: string; amount: number; text: string; date: string }[] = [];
        const { start, end } = dateRangeLimits;

        Object.entries(allChats).forEach(([date, chat]) => {
            if (date >= start && date <= end) {
                chat.expenses?.forEach(exp => {
                    list.push({ ...exp, date });
                });
            }
        });

        return list.sort((a, b) => a.date.localeCompare(b.date));
    }, [allChats, dateRangeLimits]);

    // 4. Grouped Trend Data for SVG line chart
    const trendData = useMemo(() => {
        const { start, end } = dateRangeLimits;
        if (rangeExpenses.length === 0) return [];

        const grouped: Record<string, number> = {};
        const firstExpenseDate = rangeExpenses[0]?.date;
        const finalStartDate = start === '1970-01-01' ? firstExpenseDate : start;

        const startDate = new Date(finalStartDate);
        const endDate = new Date(end);
        const dayDifference = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        // Fill continuous days only if the window is reasonable (<= 31 days)
        if (dayDifference > 0 && dayDifference <= 31) {
            const temp = new Date(startDate);
            while (temp <= endDate) {
                const dStr = temp.toISOString().split('T')[0];
                grouped[dStr] = 0;
                temp.setDate(temp.getDate() + 1);
            }
        }

        rangeExpenses.forEach(exp => {
            grouped[exp.date] = (grouped[exp.date] || 0) + exp.amount;
        });

        return Object.entries(grouped)
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [rangeExpenses, dateRangeLimits]);

    // 5. SVG Chart Coordinate Points
    const trendSvgPoints = useMemo(() => {
        if (trendData.length === 0) return [];
        
        const width = 800;
        const height = 220;
        const pLeft = 50;
        const pRight = 20;
        const pTop = 20;
        const pBottom = 40;

        const maxAmount = Math.max(...trendData.map(d => d.amount), 10);
        const innerWidth = width - pLeft - pRight;
        const innerHeight = height - pTop - pBottom;

        return trendData.map((d, index) => {
            const x = pLeft + (trendData.length > 1 ? (index / (trendData.length - 1)) * innerWidth : innerWidth / 2);
            const y = pTop + innerHeight - (d.amount / maxAmount) * innerHeight;
            return {
                x,
                y,
                date: d.date,
                amount: d.amount
            };
        });
    }, [trendData]);

    // 6. Metrics Calculations for range
    const analysisStats = useMemo(() => {
        if (rangeExpenses.length === 0) {
            return {
                totalSpent: 0,
                transactionCount: 0,
                averageTransaction: 0,
                peakSpent: 0,
                peakItem: '',
                peakDate: '',
                dailyAverage: 0,
                datesCount: 0
            };
        }

        const totalSpent = rangeExpenses.reduce((sum, e) => sum + e.amount, 0);
        const transactionCount = rangeExpenses.length;
        const averageTransaction = totalSpent / transactionCount;
        
        let peakSpent = 0;
        let peakItem = '';
        let peakDate = '';
        
        const spentByDate: Record<string, number> = {};
        
        rangeExpenses.forEach(exp => {
            if (exp.amount > peakSpent) {
                peakSpent = exp.amount;
                peakItem = exp.text;
                peakDate = exp.date;
            }
            spentByDate[exp.date] = (spentByDate[exp.date] || 0) + exp.amount;
        });

        const datesCount = Object.keys(spentByDate).length;
        const dailyAverage = totalSpent / (datesCount || 1);

        return {
            totalSpent,
            transactionCount,
            averageTransaction,
            peakSpent,
            peakItem,
            peakDate,
            dailyAverage,
            datesCount
        };
    }, [rangeExpenses]);

    // 7. Grouped category breakdown for horizontal progress bars
    const categoryBreakdown = useMemo(() => {
        const groups: Record<string, { total: number; count: number; originalText: string }> = {};
        
        rangeExpenses.forEach(exp => {
            const desc = exp.text.trim();
            if (!desc) return;
            const key = desc.toLowerCase();
            if (!groups[key]) {
                groups[key] = { total: 0, count: 0, originalText: desc };
            }
            groups[key].total += exp.amount;
            groups[key].count += 1;
        });

        return Object.values(groups)
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    }, [rangeExpenses]);

    // 8. Item based metrics database (for specific range)
    const itemMetrics = useMemo(() => {
        const itemGroups: Record<string, {
            totalSpent: number;
            count: number;
            prices: number[];
            dates: string[];
            originalText: string;
        }> = {};

        rangeExpenses.forEach(exp => {
            const desc = exp.text.trim();
            if (!desc) return;
            const key = desc.toLowerCase();
            if (!itemGroups[key]) {
                itemGroups[key] = { totalSpent: 0, count: 0, prices: [], dates: [], originalText: desc };
            }
            itemGroups[key].totalSpent += exp.amount;
            itemGroups[key].count += 1;
            itemGroups[key].prices.push(exp.amount);
            itemGroups[key].dates.push(exp.date);
        });

        const list = Object.values(itemGroups).map(group => {
            const minPrice = Math.min(...group.prices);
            const maxPrice = Math.max(...group.prices);
            const averagePrice = group.totalSpent / group.count;
            const sortedDates = [...group.dates].sort();
            const lastBoughtDate = sortedDates[sortedDates.length - 1];

            return {
                text: group.originalText,
                frequency: group.count,
                totalSpent: group.totalSpent,
                averagePrice,
                minPrice,
                maxPrice,
                lastBoughtDate
            };
        });

        return list.sort((a, b) => b.totalSpent - a.totalSpent);
    }, [rangeExpenses]);

    const filteredItemMetrics = useMemo(() => {
        if (!itemSearchQuery.trim()) return itemMetrics;
        const q = itemSearchQuery.toLowerCase();
        return itemMetrics.filter(item => item.text.toLowerCase().includes(q));
    }, [itemMetrics, itemSearchQuery]);

    const handleAddExpense = async () => {
        if (!expenseAmount || !expenseDesc) return;
        const amount = parseFloat(expenseAmount);
        if (isNaN(amount)) return;

        const updatedExpenses = [
            ...((activeChat?.expenses) || []),
            { id: Date.now().toString(), amount, text: expenseDesc }
        ];

        setLocalChat(selectedDate, { expenses: updatedExpenses });
        cloudStorage.saveChat(selectedDate, { expenses: updatedExpenses }, user?.id || undefined, true);

        setExpenseAmount('');
        setExpenseDesc('');
        setShowSuggestions(false);
    };

    const removeExpense = async (id: string) => {
        if (!confirm('Delete this expense record?')) return;
        if (activeChat && activeChat.expenses) {
            const updated = activeChat.expenses.filter(e => e.id !== id);
            setLocalChat(selectedDate, { expenses: updated });
            cloudStorage.saveChat(selectedDate, { expenses: updated }, user?.id || undefined, true);
        }
    };

    const startEditing = (id: string, amount: number, text: string) => {
        setEditingId(id);
        setEditAmount(amount.toString());
        setEditDesc(text);
    };

    const saveEdit = () => {
        if (!editingId || !editAmount || !editDesc) return;
        const amount = parseFloat(editAmount);
        if (isNaN(amount)) return;
        
        if (activeChat && activeChat.expenses) {
            const updated = activeChat.expenses.map(e => 
                e.id === editingId ? { ...e, amount, text: editDesc } : e
            );
            setLocalChat(selectedDate, { expenses: updated });
            cloudStorage.saveChat(selectedDate, { expenses: updated }, user?.id || undefined, true);
        }
        setEditingId(null);
        setEditAmount('');
        setEditDesc('');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditAmount('');
        setEditDesc('');
    };

    const scanLocalGPay = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        try {
            const pdfjs = await import('pdfjs-dist');
            pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjs.getDocument(arrayBuffer).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
            }

            const cappedText = fullText.substring(0, 150000);

            const res = await fetch('/api/parse-gpay', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: cappedText })
            });

            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textOutput = await res.text();
                if (textOutput.includes('<html') || textOutput.includes('<!DOCTYPE')) {
                    throw new Error('Server timed out or uploaded PDF is too large (max 4.5MB limit).');
                }
                throw new Error('Received invalid response format from server.');
            }

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to scan');
            
            if (data.expenses && data.expenses.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const newExpenses = data.expenses.map((e: any) => ({
                    id: Date.now().toString() + Math.random().toString(36).substring(7),
                    amount: parseFloat(e.amount),
                    text: e.text
                }));

                const updatedExpenses = [
                    ...((activeChat?.expenses) || []),
                    ...newExpenses
                ];

                setLocalChat(selectedDate, { expenses: updatedExpenses });
                cloudStorage.saveChat(selectedDate, { expenses: updatedExpenses }, user?.id || undefined, true);
                alert(`Successfully imported ${data.expenses.length} transactions from GPay statement.`);
            } else {
                alert('No expenses found in the statement.');
            }
        } catch (error) {
            console.error('Scan failed:', error);
            alert(error instanceof Error ? error.message : String(error));
        } finally {
            setIsScanning(false);
            e.target.value = '';
        }
    };

    const generateAudit = async () => {
        if (!activeChat || ((activeChat.expenses?.length || 0) === 0 && (activeChat.messages?.length || 0) === 0)) {
            alert("No data to audit for this cycle.");
            return;
        }
        setIsGenerating(true);

        try {
            const chatLog = (activeChat.messages || []).map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n');
            const prompt = `Analyze the financial data for ${selectedDate}.
            Logged Transactions: ${JSON.stringify(activeChat.expenses || [])}
            Today's Chat Log:
            ${chatLog}
            
            Find all expenses (both explicitly logged ones and any mentioned within the chat log).
            
            Simply list how much was spent and where it was spent using bullet points. Do NOT add any extra commentary, judgment, or advice.
            Example format:
            - $15 at Starbucks
            - $50 for Groceries
            
            NOTHING MORE. No "BLOCKs", no reflection, no protocol correction, no greeting. Just the raw list of what was spent and where.`;

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    systemPrompt: "You are a raw data extractor. You only list expenses accurately. You never lecture, judge, or add conversational filler."
                }),
            });

            if (!response.ok) throw new Error('Audit protocol failed');
            const data = await response.json();
            const audit = data.choices[0].message.content;

            setLocalChat(selectedDate, { financialAudit: audit });
            cloudStorage.saveChat(selectedDate, { financialAudit: audit }, user?.id || undefined, true);
        } catch (error) {
            console.error(error);
            alert('Financial audit failed.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <main className="chat-page">
            <div className="bg-mesh"></div>

            <div className="chat-container" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <header className="chat-header">
                    <div className="chat-header__left" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div
                            className="status-indicator"
                            style={{
                                '--mood-color': activeChat?.botMood === 'DISAPPOINTED' ? '#ef4444' : activeChat?.botMood === 'HOPEFUL' ? '#10b981' : activeChat?.botMood === 'DOMINATOR' ? '#8b5cf6' : '#6b7280'
                            } as React.CSSProperties}
                        ></div>
                        <h1 className="app-title">
                            <span className="app-title__brand">DISCIPLINIST</span>
                        </h1>
                    </div>

                    <div className="nav-center-wrapper desktop-only" style={{ flex: 2, display: 'flex', justifyContent: 'center' }}>
                        <NavigationBar />
                    </div>

                    <div className="header-controls" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div className="profile-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', borderRadius: '100px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }}>
                                {currentPfp ? (
                                    <Image
                                        src={currentPfp}
                                        alt="avatar"
                                        width={28}
                                        height={28}
                                        style={{ borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #10b981', flexShrink: 0 }}
                                    />
                                ) : (
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '900', boxShadow: '0 2px 10px rgba(139, 92, 246, 0.3)' }}>
                                        {displayName.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                )}
                                <span className="mobile-hidden" style={{ fontSize: '0.7rem', opacity: 0.7, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600' }}>{displayName}</span>
                                <button
                                    onClick={signOut}
                                    title="Sign Out"
                                    className="logout-btn"
                                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px', transition: 'color 0.2s' }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                        <polyline points="16 17 21 12 16 7"></polyline>
                                        <line x1="21" y1="12" x2="9" y2="12"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="sidebar-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Sidebar: Date History */}
                    <div className="no-scrollbar sidebar-panel" style={{ width: '220px', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '1rem', flexShrink: 0 }}>
                        <h3 style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cycle History</h3>
                        <div className="sidebar-panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {allDates.map(date => (
                                <button
                                    key={date}
                                    onClick={() => setSelectedDate(date)}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        background: selectedDate === date ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                                        border: selectedDate === date ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
                                        color: selectedDate === date ? '#f59e0b' : 'white',
                                        textAlign: 'left',
                                        fontSize: '0.82rem',
                                        fontWeight: selectedDate === date ? '800' : '500',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {date}{date === storage.getCurrentDate() && <span style={{ fontSize: '0.6rem', marginLeft: '6px', opacity: 0.7 }}>TODAY</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                        {/* Left Column: Form & Stats */}
                        <div style={{ width: '340px', borderRight: '1px solid var(--border)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', flexShrink: 0, overflowY: 'auto' }} className="no-scrollbar">
                            <section>
                                <h3 style={{ fontSize: '0.7rem', fontWeight: '900', color: '#f59e0b', letterSpacing: '0.1em', marginBottom: '1.25rem', textTransform: 'uppercase' }}>Log Expenditure</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '4px', display: 'block' }}>AMOUNT ($)</label>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={expenseAmount}
                                            onChange={e => setExpenseAmount(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddExpense()}
                                            className="settings-input"
                                            style={{ minHeight: 'auto', padding: '12px', fontSize: '1.2rem', fontWeight: '900' }}
                                        />
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <label style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '4px', display: 'block' }}>DESCRIPTION</label>
                                        <input
                                            type="text"
                                            placeholder="What did you buy?"
                                            value={expenseDesc}
                                            onChange={e => {
                                                setExpenseDesc(e.target.value);
                                                setShowSuggestions(true);
                                                setActiveSuggestionIndex(-1);
                                            }}
                                            onFocus={() => {
                                                setShowSuggestions(true);
                                                setActiveSuggestionIndex(-1);
                                            }}
                                            onBlur={() => {
                                                setTimeout(() => setShowSuggestions(false), 250);
                                            }}
                                            onKeyDown={handleSuggestionKeyDown}
                                            className="settings-input"
                                            style={{ minHeight: 'auto', padding: '12px', width: '100%' }}
                                        />
                                        
                                        {showSuggestions && filteredSuggestions.length > 0 && (
                                            <ul style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                right: 0,
                                                background: 'var(--surface)',
                                                border: '1px solid var(--border)',
                                                borderRadius: '12px',
                                                marginTop: '4px',
                                                maxHeight: '220px',
                                                overflowY: 'auto',
                                                zIndex: 100,
                                                listStyle: 'none',
                                                padding: '6px 0',
                                                margin: 0,
                                                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                                                backdropFilter: 'blur(20px)'
                                            }} className="no-scrollbar">
                                                {filteredSuggestions.map((item, idx) => (
                                                    <li
                                                        key={idx}
                                                        onMouseDown={() => selectSuggestion(item)}
                                                        style={{
                                                            padding: '10px 14px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            background: activeSuggestionIndex === idx ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                                                            color: activeSuggestionIndex === idx ? '#f59e0b' : 'white',
                                                            transition: 'background 0.2s',
                                                            fontSize: '0.8rem'
                                                        }}
                                                        onMouseEnter={() => setActiveSuggestionIndex(idx)}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                                            <span style={{ fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.text}</span>
                                                            <span style={{ fontSize: '0.65rem', opacity: 0.6, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
                                                                ${item.price.toFixed(2)}
                                                            </span>
                                                        </div>
                                                        <span style={{ fontSize: '0.65rem', color: '#f59e0b', opacity: 0.8, fontWeight: '700', flexShrink: 0 }}>
                                                            {item.frequency}x
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleAddExpense}
                                        className="start-day-btn"
                                        style={{ margin: 0, padding: '12px', fontSize: '0.8rem', width: '100%', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 10px 20px rgba(245, 158, 11, 0.2)' }}
                                    >
                                        CONFIRM TRANSACTION
                                    </button>

                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            onChange={scanLocalGPay}
                                            style={{ display: 'none' }}
                                            id="gpay-upload"
                                        />
                                        <button
                                            onClick={() => document.getElementById('gpay-upload')?.click()}
                                            disabled={isScanning}
                                            className="start-day-btn"
                                            style={{ margin: 0, padding: '12px', fontSize: '0.8rem', width: '100%', background: 'transparent', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#f59e0b', marginTop: '8px' }}
                                        >
                                            {isScanning ? '⏳ SCANNING...' : '📄 SCAN GPAY PDF STATEMENT'}
                                        </button>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <p style={{ fontSize: '0.65rem', fontWeight: '900', opacity: 0.5, letterSpacing: '0.1em' }}>TOTAL SPENT (ALL TIME)</p>
                                        <p style={{ fontSize: '2rem', fontWeight: '900', color: 'white' }}>${stats.total.toFixed(2)}</p>
                                    </div>
                                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                                    <div>
                                        <p style={{ fontSize: '0.65rem', fontWeight: '900', opacity: 0.5, letterSpacing: '0.1em' }}>THIS CYCLE ({selectedDate})</p>
                                        <p style={{ fontSize: '1.2rem', fontWeight: '900', color: '#f59e0b' }}>${stats.dayTotal.toFixed(2)}</p>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Right Column: Transaction List & Audit OR Analysis Dashboard */}
                        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '2.5rem' }}>
                            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                                {/* Tab selector */}
                                <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--border)', marginBottom: '2rem' }}>
                                    <button 
                                        className={`analysis-tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('transactions')}
                                    >
                                        📋 Journal & Transactions
                                    </button>
                                    <button 
                                        className={`analysis-tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('analysis')}
                                    >
                                        📊 Expense Analysis
                                    </button>
                                </div>

                                {activeTab === 'transactions' ? (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                                            <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: 'white' }}>{selectedDate}</h2>
                                            <button
                                                onClick={generateAudit}
                                                disabled={isGenerating}
                                                className="start-day-btn"
                                                style={{ margin: 0, padding: '10px 20px', fontSize: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)' }}
                                            >
                                                {isGenerating ? '⏳ AUDITING...' : activeChat?.financialAudit ? '↻ RE-AUDIT' : '✦ GENERATE FINANCIAL AUDIT'}
                                            </button>
                                        </div>

                                        {activeChat?.financialAudit && (
                                            <div style={{ marginBottom: '3rem', padding: '1.5rem', borderRadius: '16px', background: 'rgba(245, 158, 11, 0.03)', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                                    <span style={{ fontSize: '1.2rem' }}>⚖️</span>
                                                    <h3 style={{ fontSize: '0.8rem', fontWeight: '900', color: '#f59e0b', letterSpacing: '0.1em' }}>DISCIPLINIST AUDIT</h3>
                                                </div>
                                                <div className="audit-content">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {cleanBotMessage(activeChat.financialAudit)}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        )}

                                        <h3 style={{ fontSize: '0.7rem', fontWeight: '900', opacity: 0.4, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1.5rem' }}>Transactions</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {(!activeChat || (activeChat.expenses?.length || 0) === 0) && (
                                                <div style={{ textAlign: 'center', padding: '3rem 0', opacity: 0.3 }}>
                                                    <p style={{ fontSize: '2rem' }}>💸</p>
                                                    <p style={{ fontWeight: '800', marginTop: '1rem', fontSize: '0.75rem' }}>NO EXPLICIT TRANSACTIONS LOGGED</p>
                                                    <p style={{ fontSize: '0.65rem', marginTop: '0.5rem' }}>The Disciplinist will audit your chat dialog if no explicit entries exist.</p>
                                                </div>
                                            )}

                                            {activeChat?.expenses?.map((exp) => (
                                                editingId === exp.id ? (
                                                    <div key={exp.id} className="expense-card" style={{
                                                        background: 'rgba(245,158,11,0.05)',
                                                        border: '1px solid rgba(245,158,11,0.4)',
                                                        borderRadius: '12px',
                                                        padding: '1.25rem',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '10px'
                                                    }}>
                                                        <input
                                                            type="text"
                                                            value={editDesc}
                                                            onChange={e => setEditDesc(e.target.value)}
                                                            className="settings-input"
                                                            style={{ padding: '8px', fontSize: '0.9rem' }}
                                                        />
                                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                            <span style={{color: '#f59e0b', fontWeight: 'bold'}}>$</span>
                                                            <input
                                                                type="number"
                                                                value={editAmount}
                                                                onChange={e => setEditAmount(e.target.value)}
                                                                className="settings-input"
                                                                style={{ padding: '8px', fontSize: '0.9rem', flex: 1 }}
                                                            />
                                                            <button onClick={saveEdit} style={{ background: '#f59e0b', color: 'black', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.7rem' }}>SAVE</button>
                                                            <button onClick={cancelEdit} style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem' }}>CANCEL</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                <div key={exp.id} className="expense-card" style={{
                                                    background: 'rgba(255,255,255,0.02)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '12px',
                                                    padding: '1.25rem',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    transition: 'all 0.2s'
                                                }}>
                                                    <div>
                                                        <p style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white' }}>{exp.text}</p>
                                                        <p style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '2px' }}>{exp.id.slice(-8)}</p>
                                                    </div>
                                                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <p style={{ fontSize: '1.1rem', fontWeight: '900', color: '#f59e0b', marginRight: '0.5rem' }}>${exp.amount.toFixed(2)}</p>
                                                        <button
                                                            onClick={() => startEditing(exp.id, exp.amount, exp.text)}
                                                            style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', opacity: 0.5, fontSize: '0.9rem', padding: '4px' }}
                                                            className="delete-hover"
                                                            title="Edit expense"
                                                        >✎</button>
                                                        <button
                                                            onClick={() => removeExpense(exp.id)}
                                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.3, fontSize: '1.2rem', padding: '4px' }}
                                                            className="delete-hover"
                                                            title="Delete expense"
                                                        >×</button>
                                                    </div>
                                                </div>
                                                )
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    // Analysis Dashboard View
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                        
                                        {/* Time range selector */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                            <span style={{ fontSize: '0.7rem', opacity: 0.5, marginRight: '8px', fontWeight: '800' }}>FILTER RANGE:</span>
                                            {(['7d', '14d', '30d', '90d', 'all', 'custom'] as const).map(p => (
                                                <button
                                                    key={p}
                                                    className={`preset-btn ${timePreset === p ? 'active' : ''}`}
                                                    onClick={() => setTimePreset(p)}
                                                >
                                                    {p === '7d' ? '7 Days' : p === '14d' ? '14 Days' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : p === 'all' ? 'All Time' : 'Custom'}
                                                </button>
                                            ))}
                                            
                                            {timePreset === 'custom' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
                                                    <input
                                                        type="date"
                                                        value={customStartDate}
                                                        onChange={e => setCustomStartDate(e.target.value)}
                                                        className="settings-input"
                                                        style={{ minHeight: 'auto', padding: '6px 10px', fontSize: '0.75rem', width: '125px' }}
                                                    />
                                                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>to</span>
                                                    <input
                                                        type="date"
                                                        value={customEndDate}
                                                        onChange={e => setCustomEndDate(e.target.value)}
                                                        className="settings-input"
                                                        style={{ minHeight: 'auto', padding: '6px 10px', fontSize: '0.75rem', width: '125px' }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Metrics Grid */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                            <div className="metric-card">
                                                <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Total Spent</span>
                                                <span style={{ fontSize: '1.6rem', fontWeight: '900', color: 'white' }}>${analysisStats.totalSpent.toFixed(2)}</span>
                                                <span style={{ fontSize: '0.65rem', opacity: 0.4 }}>For chosen date range</span>
                                            </div>
                                            <div className="metric-card">
                                                <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Daily Average</span>
                                                <span style={{ fontSize: '1.6rem', fontWeight: '900', color: '#f59e0b' }}>${analysisStats.dailyAverage.toFixed(2)}</span>
                                                <span style={{ fontSize: '0.65rem', opacity: 0.4 }}>Across {analysisStats.datesCount} active days</span>
                                            </div>
                                            <div className="metric-card" style={{ gridColumn: 'span 2' }}>
                                                <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Peak Single Spend</span>
                                                {analysisStats.peakSpent > 0 ? (
                                                    <>
                                                        <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#ef4444', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                            ${analysisStats.peakSpent.toFixed(2)} <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>on {analysisStats.peakItem}</span>
                                                        </span>
                                                        <span style={{ fontSize: '0.65rem', opacity: 0.4 }}>Logged on {analysisStats.peakDate}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span style={{ fontSize: '1.3rem', fontWeight: '900', color: 'rgba(255,255,255,0.2)' }}>None</span>
                                                        <span style={{ fontSize: '0.65rem', opacity: 0.4 }}>No logs found in range</span>
                                                    </>
                                                )}
                                            </div>
                                            <div className="metric-card">
                                                <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Total Entries</span>
                                                <span style={{ fontSize: '1.6rem', fontWeight: '900', color: 'white' }}>{analysisStats.transactionCount}</span>
                                                <span style={{ fontSize: '0.65rem', opacity: 0.4 }}>Avg size: ${analysisStats.averageTransaction.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {/* SVG Spend Trend Graph */}
                                        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '16px' }}>
                                            <h3 style={{ fontSize: '0.8rem', fontWeight: '900', color: 'white', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Spending Trend Graph</h3>
                                            {trendData.length > 0 ? (
                                                <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }} className="no-scrollbar">
                                                    <div style={{ minWidth: '700px', height: '240px', position: 'relative' }}>
                                                        <svg width="100%" height="220" viewBox="0 0 800 220" style={{ overflow: 'visible' }}>
                                                            <defs>
                                                                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25"/>
                                                                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0"/>
                                                                </linearGradient>
                                                            </defs>

                                                            {/* Y Gridlines */}
                                                            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                                                                const y = 20 + ratio * 160;
                                                                const maxAmt = Math.max(...trendData.map(d => d.amount), 10);
                                                                const labelVal = maxAmt - ratio * maxAmt;
                                                                return (
                                                                    <g key={i}>
                                                                        <line 
                                                                            x1="50" 
                                                                            y1={y} 
                                                                            x2="780" 
                                                                            y2={y} 
                                                                            stroke="rgba(255,255,255,0.03)" 
                                                                            strokeWidth="1.5" 
                                                                            strokeDasharray="4 4"
                                                                        />
                                                                        <text 
                                                                            x="40" 
                                                                            y={y + 3} 
                                                                            fill="rgba(255,255,255,0.3)" 
                                                                            fontSize="8" 
                                                                            fontWeight="700" 
                                                                            textAnchor="end"
                                                                        >
                                                                            ${labelVal.toFixed(0)}
                                                                        </text>
                                                                    </g>
                                                                );
                                                            })}

                                                            {/* X Gridlines */}
                                                            {trendSvgPoints.map((pt, i) => {
                                                                const showLabel = trendSvgPoints.length <= 10 || i % Math.ceil(trendSvgPoints.length / 10) === 0 || i === trendSvgPoints.length - 1;
                                                                let shortDate = pt.date;
                                                                try {
                                                                    const parts = pt.date.split('-');
                                                                    if (parts.length === 3) {
                                                                        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                                                                        shortDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                                                    }
                                                                } catch {}

                                                                return (
                                                                    <g key={i}>
                                                                        {showLabel && (
                                                                            <>
                                                                                <line 
                                                                                    x1={pt.x} 
                                                                                    y1="20" 
                                                                                    x2={pt.x} 
                                                                                    y2="180" 
                                                                                    stroke="rgba(255,255,255,0.02)" 
                                                                                    strokeWidth="1"
                                                                                />
                                                                                <text 
                                                                                    x={pt.x} 
                                                                                    y="200" 
                                                                                    fill="rgba(255,255,255,0.3)" 
                                                                                    fontSize="8" 
                                                                                    fontWeight="800" 
                                                                                    textAnchor="middle"
                                                                                >
                                                                                    {shortDate}
                                                                                </text>
                                                                            </>
                                                                        )}
                                                                    </g>
                                                                );
                                                            })}

                                                            {/* Area Fill */}
                                                            {trendSvgPoints.length > 1 && (
                                                                <path 
                                                                    d={`${trendSvgPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '')} L ${trendSvgPoints[trendSvgPoints.length - 1].x} 180 L ${trendSvgPoints[0].x} 180 Z`}
                                                                    fill="url(#spendGrad)"
                                                                />
                                                            )}

                                                            {/* Main Line */}
                                                            {trendSvgPoints.length > 1 && (
                                                                <path 
                                                                    d={trendSvgPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '')}
                                                                    fill="none" 
                                                                    stroke="#f59e0b" 
                                                                    strokeWidth="3.5" 
                                                                    strokeLinecap="round" 
                                                                    strokeLinejoin="round"
                                                                    style={{ filter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.3))' }}
                                                                />
                                                            )}

                                                            {/* Dots */}
                                                            {trendSvgPoints.map((pt, i) => (
                                                                <g key={i}>
                                                                    <circle 
                                                                        cx={pt.x} 
                                                                        cy={pt.y} 
                                                                        r={hoveredPointIdx === i ? 6 : 3.5} 
                                                                        fill={hoveredPointIdx === i ? "#fff" : "#f59e0b"} 
                                                                        stroke={hoveredPointIdx === i ? "#f59e0b" : "transparent"}
                                                                        strokeWidth={hoveredPointIdx === i ? 2 : 0}
                                                                        style={{ transition: 'all 0.1s', cursor: 'pointer' }}
                                                                        onMouseEnter={() => setHoveredPointIdx(i)}
                                                                        onMouseLeave={() => setHoveredPointIdx(null)}
                                                                    />
                                                                </g>
                                                            ))}
                                                        </svg>
                                                        
                                                        {/* Tooltip Overlay */}
                                                        {hoveredPointIdx !== null && trendSvgPoints[hoveredPointIdx] && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                left: `${trendSvgPoints[hoveredPointIdx].x - 60}px`,
                                                                top: `${trendSvgPoints[hoveredPointIdx].y - 55}px`,
                                                                background: '#12121a',
                                                                border: '1px solid rgba(245,158,11,0.4)',
                                                                padding: '6px 10px',
                                                                borderRadius: '8px',
                                                                pointerEvents: 'none',
                                                                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                                                                zIndex: 10,
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '2px',
                                                                width: '120px',
                                                                textAlign: 'center'
                                                            }}>
                                                                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700' }}>
                                                                    {trendSvgPoints[hoveredPointIdx].date}
                                                                </span>
                                                                <span style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: '900' }}>
                                                                    ${trendSvgPoints[hoveredPointIdx].amount.toFixed(2)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ padding: '3rem 0', textAlign: 'center', opacity: 0.3 }}>
                                                    <p style={{ fontSize: '1.5rem' }}>📈</p>
                                                    <p style={{ fontSize: '0.75rem', fontWeight: '800', marginTop: '0.5rem' }}>NO TREND DATA</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Categories and Behavior Grid */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
                                            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '16px' }}>
                                                <h3 style={{ fontSize: '0.8rem', fontWeight: '900', color: 'white', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Items by Total Spend</h3>
                                                {categoryBreakdown.length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                                        {categoryBreakdown.map((cat, i) => {
                                                            const percentage = (cat.total / (analysisStats.totalSpent || 1)) * 100;
                                                            return (
                                                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '700' }}>
                                                                        <span style={{ color: 'white' }}>{cat.originalText} <span style={{ opacity: 0.4, fontWeight: 'normal' }}>({cat.count}x)</span></span>
                                                                        <span style={{ color: '#f59e0b' }}>${cat.total.toFixed(2)} <span style={{ opacity: 0.5, fontSize: '0.65rem' }}>({percentage.toFixed(0)}%)</span></span>
                                                                    </div>
                                                                    <div className="progress-bar-bg">
                                                                        <div className="progress-bar-fill" style={{ width: `${percentage}%` }}></div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div style={{ padding: '2rem 0', textAlign: 'center', opacity: 0.3 }}>
                                                        <p style={{ fontSize: '0.75rem', fontWeight: '800' }}>NO CATEGORY SPEND FOUND</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                                                <div>
                                                    <h3 style={{ fontSize: '0.8rem', fontWeight: '900', color: 'white', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shopping Behavior</h3>
                                                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>
                                                        Over this cycle range, you logged a total of <strong>{analysisStats.transactionCount}</strong> separate expenditures. 
                                                        Your average single transaction was <strong>${analysisStats.averageTransaction.toFixed(2)}</strong>.
                                                    </p>
                                                </div>
                                                <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.03)', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                                                    <span style={{ fontSize: '0.6rem', fontWeight: '900', color: '#f59e0b', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>ANALYSIS NOTE</span>
                                                    <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>
                                                        {analysisStats.totalSpent > 300 
                                                            ? "High spending detected in this period. Keep an eye on items above your daily average to enforce discipline."
                                                            : "Excellent spending control. Your expenditures remain moderate and well-distributed."}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Detailed Item metrics table */}
                                        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                                <h3 style={{ fontSize: '0.8rem', fontWeight: '900', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detailed Item-Based Breakdown</h3>
                                                
                                                <input
                                                    type="text"
                                                    placeholder="Search items..."
                                                    value={itemSearchQuery}
                                                    onChange={e => setItemSearchQuery(e.target.value)}
                                                    className="settings-input"
                                                    style={{ minHeight: 'auto', padding: '6px 12px', fontSize: '0.75rem', width: '180px' }}
                                                />
                                            </div>

                                            {filteredItemMetrics.length > 0 ? (
                                                <div style={{ overflowX: 'auto' }} className="no-scrollbar">
                                                    <table className="item-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Item Name</th>
                                                                <th style={{ textAlign: 'center' }}>Times Bought</th>
                                                                <th style={{ textAlign: 'right' }}>Total Spent</th>
                                                                <th style={{ textAlign: 'right' }}>Avg Price</th>
                                                                <th style={{ textAlign: 'center' }}>Price Min / Max</th>
                                                                <th style={{ textAlign: 'right' }}>Last Purchased</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filteredItemMetrics.map((item, idx) => (
                                                                <tr key={idx}>
                                                                    <td style={{ fontWeight: '700', color: 'white' }}>{item.text}</td>
                                                                    <td style={{ textAlign: 'center', color: '#f59e0b', fontWeight: '800' }}>{item.frequency}x</td>
                                                                    <td style={{ textAlign: 'right', fontWeight: '800' }}>${item.totalSpent.toFixed(2)}</td>
                                                                    <td style={{ textAlign: 'right', opacity: 0.8 }}>${item.averagePrice.toFixed(2)}</td>
                                                                    <td style={{ textAlign: 'center', opacity: 0.6, fontSize: '0.72rem' }}>
                                                                        ${item.minPrice.toFixed(2)} - ${item.maxPrice.toFixed(2)}
                                                                    </td>
                                                                    <td style={{ textAlign: 'right', opacity: 0.5, fontSize: '0.72rem' }}>{item.lastBoughtDate}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div style={{ padding: '3rem 0', textAlign: 'center', opacity: 0.3 }}>
                                                    <p style={{ fontSize: '0.75rem', fontWeight: '800' }}>NO ITEMS MATCH YOUR SEARCH</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <MobileBottomNav />
            </div>

            <style jsx>{`
                .expense-card:hover {
                    background: rgba(255,255,255,0.04) !important;
                    border-color: rgba(245, 158, 11, 0.3) !important;
                    transform: translateY(-2px);
                }
                .delete-hover:hover {
                    opacity: 1 !important;
                }
                .nav-link.active {
                    color: #f59e0b !important;
                }
                .audit-content {
                    font-size: 0.85rem;
                    line-height: 1.6;
                    color: rgba(255,255,255,0.8);
                }
                .audit-content :global(ul) {
                    padding-left: 1.2rem;
                    margin: 0;
                }
                .audit-content :global(li) {
                    margin-bottom: 0.5rem;
                }
                .audit-content :global(strong) {
                    color: white;
                }
                .analysis-tab-btn {
                    background: transparent;
                    border: none;
                    color: rgba(255,255,255,0.5);
                    padding: 8px 16px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    transition: all 0.2s;
                }
                .analysis-tab-btn.active {
                    color: #f59e0b;
                    border-bottom: 2px solid #f59e0b;
                }
                .metric-card {
                    background: rgba(255,255,255,0.02);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 1.25rem;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .preset-btn {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid var(--border);
                    color: rgba(255,255,255,0.7);
                    padding: 6px 12px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .preset-btn.active {
                    background: rgba(245, 158, 11, 0.1);
                    border-color: rgba(245, 158, 11, 0.4);
                    color: #f59e0b;
                }
                .progress-bar-bg {
                    background: rgba(255,255,255,0.05);
                    height: 6px;
                    border-radius: 3px;
                    overflow: hidden;
                }
                .progress-bar-fill {
                    background: linear-gradient(90deg, #f59e0b, #d97706);
                    height: 100%;
                    border-radius: 3px;
                }
                .item-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                }
                .item-table th {
                    font-size: 0.65rem;
                    text-transform: uppercase;
                    color: rgba(255,255,255,0.4);
                    font-weight: 800;
                    letter-spacing: 0.05em;
                    padding: 10px 14px;
                    border-bottom: 1px solid var(--border);
                }
                .item-table td {
                    font-size: 0.8rem;
                    padding: 12px 14px;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                }
                .item-table tr:hover td {
                    background: rgba(255,255,255,0.01);
                }
            `}</style>
        </main>
    );
}
