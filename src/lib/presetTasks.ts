export interface PresetTask {
  id: string;
  name: string;
  category: string;
  description?: string;
  estimatedTime?: number; // in minutes
  createdAt: number;
  isActive: boolean;
}

export interface PresetTaskCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export class PresetTaskManager {
  private static readonly STORAGE_KEY = 'disciplinist_preset_tasks';

  private static readonly DEFAULT_CATEGORIES: PresetTaskCategory[] = [
    { id: 'work', name: 'Work', color: '#3b82f6', icon: '💼' },
    { id: 'personal', name: 'Personal', color: '#10b981', icon: '🏠' },
    { id: 'health', name: 'Health', color: '#ef4444', icon: '💪' },
    { id: 'learning', name: 'Learning', color: '#8b5cf6', icon: '📚' },
    { id: 'creative', name: 'Creative', color: '#f59e0b', icon: '🎨' }
  ];

  private static readonly DEFAULT_TASKS: PresetTask[] = [
    { id: '1', name: 'Deep Work Session', category: 'work', description: 'Focused work without distractions', estimatedTime: 90, createdAt: Date.now(), isActive: true },
    { id: '2', name: 'Email Processing', category: 'work', description: 'Clear inbox and respond to important emails', estimatedTime: 30, createdAt: Date.now(), isActive: true },
    { id: '3', name: 'Exercise', category: 'health', description: 'Physical workout or activity', estimatedTime: 45, createdAt: Date.now(), isActive: true },
    { id: '4', name: 'Reading', category: 'learning', description: 'Read educational material', estimatedTime: 60, createdAt: Date.now(), isActive: true },
    { id: '5', name: 'Meditation', category: 'personal', description: 'Mindfulness and meditation practice', estimatedTime: 15, createdAt: Date.now(), isActive: true },
    { id: '6', name: 'Creative Project', category: 'creative', description: 'Work on creative endeavors', estimatedTime: 120, createdAt: Date.now(), isActive: true },
    { id: '7', name: 'Code Review', category: 'work', description: 'Review and improve code quality', estimatedTime: 60, createdAt: Date.now(), isActive: true },
    { id: '8', name: 'Planning Session', category: 'work', description: 'Plan tasks and priorities', estimatedTime: 30, createdAt: Date.now(), isActive: true }
  ];

  static getCategories(): PresetTaskCategory[] {
    return this.DEFAULT_CATEGORIES;
  }

  static getTasks(): PresetTask[] {
    if (typeof window === 'undefined') return this.DEFAULT_TASKS;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const tasks = JSON.parse(stored);
        return tasks.map((task: PresetTask) => ({
          ...task,
          isActive: task.isActive !== false // Default to true if not specified
        }));
      }
    } catch (error) {
      console.error('Failed to load preset tasks:', error);
    }

    return this.DEFAULT_TASKS;
  }

  static saveTasks(tasks: PresetTask[]): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error('Failed to save preset tasks:', error);
    }
  }

  static addTask(task: Omit<PresetTask, 'id' | 'createdAt'>): PresetTask {
    const newTask: PresetTask = {
      ...task,
      id: Date.now().toString(),
      createdAt: Date.now(),
      isActive: true
    };

    const tasks = this.getTasks();
    tasks.push(newTask);
    this.saveTasks(tasks);

    return newTask;
  }

  static updateTask(id: string, updates: Partial<PresetTask>): PresetTask | null {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);

    if (index === -1) return null;

    tasks[index] = { ...tasks[index], ...updates };
    this.saveTasks(tasks);

    return tasks[index];
  }

  static deleteTask(id: string): boolean {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);

    if (index === -1) return false;

    tasks.splice(index, 1);
    this.saveTasks(tasks);

    return true;
  }

  static toggleTask(id: string): PresetTask | null {
    const tasks = this.getTasks();
    const task = tasks.find(t => t.id === id);

    if (!task) return null;

    return this.updateTask(id, { isActive: !task.isActive });
  }

  static getActiveTasks(): PresetTask[] {
    return this.getTasks().filter(task => task.isActive);
  }

  static getTasksByCategory(categoryId: string): PresetTask[] {
    return this.getTasks().filter(task => task.category === categoryId);
  }

  static getCategoryById(categoryId: string): PresetTaskCategory | undefined {
    return this.DEFAULT_CATEGORIES.find(cat => cat.id === categoryId);
  }
}
