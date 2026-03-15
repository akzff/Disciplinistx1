'use client';

import { useState, useEffect } from 'react';
import { PresetTask, PresetTaskCategory, PresetTaskManager } from '@/lib/presetTasks';

interface PresetTaskSelectorProps {
  onTaskSelect: (taskName: string) => void;
  onClose: () => void;
}

export default function PresetTaskSelector({ onTaskSelect, onClose }: PresetTaskSelectorProps) {
  const [tasks, setTasks] = useState<PresetTask[]>([]);
  const [categories, setCategories] = useState<PresetTaskCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<PresetTask | null>(null);
  const [newTask, setNewTask] = useState({ name: '', category: 'work', description: '', estimatedTime: 30 });

  useEffect(() => {
    setTasks(PresetTaskManager.getTasks());
    setCategories(PresetTaskManager.getCategories());
  }, []);

  const filteredTasks = selectedCategory === 'all' 
    ? tasks.filter(task => task.isActive)
    : tasks.filter(task => task.isActive && task.category === selectedCategory);

  const handleAddTask = () => {
    if (!newTask.name.trim()) return;
    
    if (editingTask) {
      PresetTaskManager.updateTask(editingTask.id, {
        name: newTask.name.trim(),
        category: newTask.category,
        description: newTask.description.trim(),
        estimatedTime: newTask.estimatedTime
      });
    } else {
      PresetTaskManager.addTask({
        name: newTask.name.trim(),
        category: newTask.category,
        description: newTask.description.trim(),
        estimatedTime: newTask.estimatedTime,
        isActive: true
      });
    }
    
    setTasks(PresetTaskManager.getTasks());
    setNewTask({ name: '', category: 'work', description: '', estimatedTime: 30 });
    setIsAddingTask(false);
    setEditingTask(null);
  };

  const handleEditTask = (task: PresetTask) => {
    setEditingTask(task);
    setNewTask({
      name: task.name,
      category: task.category,
      description: task.description || '',
      estimatedTime: task.estimatedTime || 30
    });
    setIsAddingTask(true);
  };

  const handleDeleteTask = (taskId: string) => {
    if (confirm('Are you sure you want to delete this preset task?')) {
      PresetTaskManager.deleteTask(taskId);
      setTasks(PresetTaskManager.getTasks());
    }
  };

  const handleToggleTask = (taskId: string) => {
    PresetTaskManager.toggleTask(taskId);
    setTasks(PresetTaskManager.getTasks());
  };

  const getCategoryInfo = (categoryId: string) => {
    return categories.find(cat => cat.id === categoryId);
  };

  return (
    <div className="preset-task-overlay">
      <div className="preset-task-modal">
        <div className="preset-task-header">
          <h3>Preset Tasks</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="preset-task-content">
          {/* Category Filter */}
          <div className="category-filter">
            <button 
              className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All
            </button>
            {categories.map(category => (
              <button
                key={category.id}
                className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.id)}
                style={{ '--category-color': category.color } as React.CSSProperties}
              >
                <span>{category.icon}</span>
                {category.name}
              </button>
            ))}
          </div>

          {/* Task List */}
          <div className="task-list">
            {filteredTasks.length === 0 ? (
              <div className="empty-state">
                <p>No preset tasks found.</p>
                <button onClick={() => setIsAddingTask(true)} className="add-first-task-btn">
                  Add your first preset task
                </button>
              </div>
            ) : (
              filteredTasks.map(task => {
                const category = getCategoryInfo(task.category);
                return (
                  <div key={task.id} className="preset-task-item">
                    <div className="task-info">
                      <div className="task-header">
                        <span className="task-category" style={{ color: category?.color }}>
                          {category?.icon}
                        </span>
                        <span className="task-name">{task.name}</span>
                        {task.estimatedTime && (
                          <span className="task-time">{task.estimatedTime}m</span>
                        )}
                      </div>
                      {task.description && (
                        <p className="task-description">{task.description}</p>
                      )}
                    </div>
                    <div className="task-actions">
                      <button 
                        onClick={() => onTaskSelect(task.name)}
                        className="select-btn"
                        title="Start this task"
                      >
                        ▶
                      </button>
                      <button 
                        onClick={() => handleToggleTask(task.id)}
                        className={`toggle-btn ${task.isActive ? 'active' : 'inactive'}`}
                        title={task.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {task.isActive ? '👁' : '👁‍🗨'}
                      </button>
                      <button 
                        onClick={() => handleEditTask(task)}
                        className="edit-btn"
                        title="Edit task"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDeleteTask(task.id)}
                        className="delete-btn"
                        title="Delete task"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add/Edit Task Form */}
          {isAddingTask && (
            <div className="add-task-form">
              <h4>{editingTask ? 'Edit Task' : 'Add New Task'}</h4>
              <div className="form-group">
                <label>Task Name</label>
                <input
                  type="text"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  placeholder="Enter task name..."
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  value={newTask.category}
                  onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Enter task description..."
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Estimated Time (minutes)</label>
                <input
                  type="number"
                  value={newTask.estimatedTime}
                  onChange={(e) => setNewTask({ ...newTask, estimatedTime: parseInt(e.target.value) || 30 })}
                  min="5"
                  max="480"
                />
              </div>
              <div className="form-actions">
                <button onClick={handleAddTask} className="save-btn">
                  {editingTask ? 'Update' : 'Add'} Task
                </button>
                <button 
                  onClick={() => {
                    setIsAddingTask(false);
                    setEditingTask(null);
                    setNewTask({ name: '', category: 'work', description: '', estimatedTime: 30 });
                  }} 
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Add Task Button */}
          {!isAddingTask && (
            <button 
              onClick={() => setIsAddingTask(true)} 
              className="add-task-btn"
            >
              + Add New Task
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .preset-task-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .preset-task-modal {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 16px;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .preset-task-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid var(--border);
        }

        .preset-task-header h3 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 800;
          color: white;
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .preset-task-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .category-filter {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .category-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 600;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .category-btn.active {
          background: var(--category-color, var(--accent));
          color: white;
          border-color: var(--category-color, var(--accent));
        }

        .category-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .task-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: var(--text-secondary);
        }

        .add-first-task-btn {
          background: var(--accent);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          margin-top: 1rem;
        }

        .preset-task-item {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.2s ease;
        }

        .preset-task-item:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: var(--accent);
        }

        .task-info {
          flex: 1;
        }

        .task-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .task-category {
          font-size: 1.2rem;
        }

        .task-name {
          font-weight: 700;
          color: white;
          font-size: 0.95rem;
        }

        .task-time {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-secondary);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .task-description {
          color: var(--text-secondary);
          font-size: 0.85rem;
          margin: 0;
          line-height: 1.4;
        }

        .task-actions {
          display: flex;
          gap: 0.5rem;
        }

        .task-actions button {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          width: 36px;
          height: 36px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          transition: all 0.2s ease;
        }

        .select-btn:hover {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }

        .toggle-btn.active {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
          border-color: #10b981;
        }

        .edit-btn:hover {
          background: rgba(139, 92, 246, 0.2);
          color: #8b5cf6;
          border-color: #8b5cf6;
        }

        .delete-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
          border-color: #ef4444;
        }

        .add-task-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border);
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          width: 100%;
          transition: all 0.2s ease;
        }

        .add-task-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: var(--accent);
        }

        .add-task-form {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .add-task-form h4 {
          margin: 0 0 1rem 0;
          color: white;
          font-size: 1.1rem;
          font-weight: 700;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border);
          color: white;
          padding: 0.75rem;
          border-radius: 8px;
          font-size: 0.9rem;
        }

        .form-group textarea {
          resize: vertical;
          min-height: 80px;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .save-btn {
          background: var(--accent);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }

        .cancel-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .preset-task-modal {
            width: 95%;
            max-height: 90vh;
          }

          .preset-task-content {
            padding: 1rem;
          }

          .category-filter {
            gap: 0.25rem;
          }

          .category-btn {
            padding: 0.4rem 0.8rem;
            font-size: 0.8rem;
          }

          .preset-task-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .task-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
      `}</style>
    </div>
  );
}
