import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  X,
  Send,
  Settings,
  Bot,
  User,
  Zap,
  Target,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import { useTodayStr } from '../../hooks/useCurrentDate';
import {
  aiProviderService,
  type ChatMessage,
} from '../../services/aiProviderService';
import {
  saveLocalAiConfig,
  type AiProviderConfig,
} from '../../services/cryptoVaultService';
import { SPRING_TACTILE } from '../../utils/springPhysics';
import { audioEngine } from '../../utils/audioEngine';
import { Badge } from '../ui';

export interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  targetTaskId?: string;
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  isOpen,
  onClose,
  targetTaskId,
}) => {
  const { tasks, projects, showToast } = useTaskContext();
  const todayStr = useTodayStr();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hello! I'm your FlowTask Copilot. I can help you plan your day, break down complex tasks into micro-steps, check your goal alignment, or reschedule slipping items. What would you like to focus on?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<AiProviderConfig>(() =>
    aiProviderService.getConfig()
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Build real-time workspace context for the AI
  const buildWorkspaceContext = useCallback(() => {
    const todayTasks = tasks.filter(
      (t) =>
        !t.deletedAt &&
        !t.archivedAt &&
        (t.plannedDate === todayStr || t.isPinnedToday)
    );
    const activeTasks = tasks.filter(
      (t) => !t.deletedAt && !t.archivedAt && t.status !== 'done'
    );
    const targetTask = targetTaskId
      ? tasks.find((t) => t.id === targetTaskId)
      : null;

    return `CURRENT WORKSPACE CONTEXT:
Today's Date: ${todayStr}
Total Active Tasks: ${activeTasks.length}
Today's Scheduled Tasks (${todayTasks.length}):
${todayTasks.map((t) => `- [${t.priority.toUpperCase()}] ${t.title} (${t.status})`).join('\n')}

Active Projects:
${projects.map((p) => `- ${p.name} (id: ${p.id})`).join('\n')}
${
  targetTask
    ? `\nCURRENTLY SELECTED TASK:
Title: ${targetTask.title}
Priority: ${targetTask.priority}
Description: ${targetTask.description || 'None'}`
    : ''
}`;
  }, [tasks, projects, todayStr, targetTaskId]);

  const handleSendMessage = async (textToSend?: string) => {
    const queryText = (textToSend || input).trim();
    if (!queryText || loading) return;

    try {
      audioEngine.playClickSound();
    } catch {}

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: queryText },
    ];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const context = buildWorkspaceContext();
      const response = await aiProviderService.queryChat(
        newMessages,
        context
      );
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Error: ${err instanceof Error ? err.message : 'Failed to query AI provider.'} Please verify your API key in settings.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = () => {
    aiProviderService.setConfig(config);
    saveLocalAiConfig(config);
    setShowConfig(false);
    showToast('AI Provider configuration saved.');
  };

  const handleQuickPrompt = (prompt: string) => {
    void handleSendMessage(prompt);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex justify-end">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/35 backdrop-blur-[2px] pointer-events-auto"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={SPRING_TACTILE}
        className="relative z-10 pointer-events-auto w-full sm:w-[480px] md:w-[520px] h-[100dvh] bg-[var(--bg-surface-l1)] border-l border-[var(--border-hairline)] shadow-cute-modal flex flex-col overflow-hidden text-[var(--text-primary)]"
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between bg-[var(--bg-surface-l2)]/60 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
              <Sparkles size={18} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight flex items-center gap-2">
                FlowTask Copilot
                <Badge variant="brand" size="xs" className="font-mono uppercase text-[10px]">
                  {config.activeProvider}
                </Badge>
              </h2>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">
                {config.activeProvider === 'openrouter' && (config.openRouterModel || 'Claude 3.5 Sonnet')}
                {config.activeProvider === 'gemini' && (config.geminiModel || 'Gemini 2.5 Flash')}
                {config.activeProvider === 'openai' && (config.openAiModel || 'GPT-4o Mini')}
                {config.activeProvider === 'anthropic' && (config.anthropicModel || 'Claude 3.5 Sonnet')}
                {config.activeProvider === 'ollama' && 'Ollama (Local)'}
                {config.activeProvider === 'offline' && 'Offline Heuristics'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowConfig((prev) => !prev)}
              title="Provider & API Key Settings"
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors enabled:active:scale-[0.96]"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={onClose}
              title="Close Copilot (Esc)"
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors enabled:active:scale-[0.96]"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Settings Overlay View */}
        {showConfig ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold">AI Provider & Credentials</h3>
              <p className="text-xs text-[var(--text-muted)]">
                Choose your AI engine. All keys are encrypted client-side and never touch an intermediary server.
              </p>
            </div>

            {/* Provider Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Active Provider
              </label>
              <select
                value={config.activeProvider}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    activeProvider: e.target.value as AiProviderConfig['activeProvider'],
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-strong)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-brand)]"
              >
                <option value="gemini">Google Gemini (Gemini 2.5/3.8 Flash & Pro)</option>
                <option value="openrouter">OpenRouter (Claude 3.7, DeepSeek R1, GPT-4o)</option>
                <option value="openai">OpenAI (GPT-4o, GPT-4o Mini)</option>
                <option value="anthropic">Anthropic (Claude 3.5 Sonnet direct)</option>
                <option value="ollama">Ollama (100% Local / Private)</option>
                <option value="offline">Offline Heuristic Engine (No Key Needed)</option>
              </select>
            </div>

            {/* Provider Specific Inputs */}
            {config.activeProvider === 'gemini' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Gemini API Key</label>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={config.geminiKey || ''}
                    onChange={(e) => setConfig({ ...config, geminiKey: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-xs font-mono outline-none focus:border-[var(--color-brand)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Model</label>
                  <input
                    type="text"
                    value={config.geminiModel || 'gemini-2.5-flash'}
                    onChange={(e) => setConfig({ ...config, geminiModel: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-xs font-mono outline-none focus:border-[var(--color-brand)]"
                  />
                </div>
              </div>
            )}

            {config.activeProvider === 'openrouter' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">OpenRouter API Key</label>
                  <input
                    type="password"
                    placeholder="sk-or-v1-..."
                    value={config.openRouterKey || ''}
                    onChange={(e) => setConfig({ ...config, openRouterKey: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-xs font-mono outline-none focus:border-[var(--color-brand)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Model String</label>
                  <input
                    type="text"
                    placeholder="anthropic/claude-3.5-sonnet"
                    value={config.openRouterModel || 'anthropic/claude-3.5-sonnet'}
                    onChange={(e) => setConfig({ ...config, openRouterModel: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-xs font-mono outline-none focus:border-[var(--color-brand)]"
                  />
                </div>
              </div>
            )}

            {config.activeProvider === 'openai' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">OpenAI API Key</label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={config.openAiKey || ''}
                    onChange={(e) => setConfig({ ...config, openAiKey: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-xs font-mono outline-none focus:border-[var(--color-brand)]"
                  />
                </div>
              </div>
            )}

            {config.activeProvider === 'ollama' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Ollama Base URL</label>
                  <input
                    type="text"
                    value={config.ollamaUrl || 'http://localhost:11434'}
                    onChange={(e) => setConfig({ ...config, ollamaUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-xs font-mono outline-none focus:border-[var(--color-brand)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Ollama Model</label>
                  <input
                    type="text"
                    value={config.ollamaModel || 'llama3.2'}
                    onChange={(e) => setConfig({ ...config, ollamaModel: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-xs font-mono outline-none focus:border-[var(--color-brand)]"
                  />
                </div>
              </div>
            )}

            <div className="pt-4 flex gap-2">
              <button
                onClick={handleSaveConfig}
                className="flex-1 py-2.5 rounded-xl bg-[var(--color-brand)] text-[var(--text-on-brand)] text-xs font-bold shadow-subtle hover:bg-[var(--color-brand-hover)] transition-all enabled:active:scale-[0.96]"
              >
                Save & Apply Settings
              </button>
              <button
                onClick={() => setShowConfig(false)}
                className="px-4 py-2.5 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-xs font-semibold hover:bg-[var(--bg-surface-l3)] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Chat Message Stream */
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.map((m, idx) => {
              const isAssistant = m.role === 'assistant';
              return (
                <div
                  key={idx}
                  className={`flex gap-3 ${isAssistant ? '' : 'flex-row-reverse'}`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs ${
                      isAssistant
                        ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                        : 'bg-[var(--color-brand)] text-[var(--text-on-brand)]'
                    }`}
                  >
                    {isAssistant ? <Bot size={15} /> : <User size={15} />}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                      isAssistant
                        ? 'bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-[var(--text-primary)] shadow-subtle'
                        : 'bg-[var(--color-brand)] text-[var(--text-on-brand)] shadow-subtle'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                  <RefreshCw size={14} className="animate-spin" />
                </div>
                <div className="bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] rounded-2xl px-4 py-2.5 text-xs text-[var(--text-muted)] flex items-center gap-2">
                  <span>Synthesizing response...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Quick Action Chips */}
        {!showConfig && (
          <div className="px-4 py-2 border-t border-[var(--border-hairline)] bg-[var(--bg-surface-l2)]/30 flex gap-1.5 overflow-x-auto shrink-0">
            <button
              onClick={() => handleQuickPrompt("Generate a structured morning focus plan for today based on my active tasks.")}
              className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-[11px] hover:border-[var(--color-brand)] transition-colors flex items-center gap-1.5 enabled:active:scale-[0.96]"
            >
              <Zap size={12} className="text-amber-500" />
              Plan My Day
            </button>
            <button
              onClick={() => handleQuickPrompt("Break down my highest priority task into 4 physical sub-actions.")}
              className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-[11px] hover:border-[var(--color-brand)] transition-colors flex items-center gap-1.5 enabled:active:scale-[0.96]"
            >
              <Layers size={12} className="text-purple-500" />
              Break Down Task
            </button>
            <button
              onClick={() => handleQuickPrompt("Analyze my active goals and tell me if today's planned work aligns with them.")}
              className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-[11px] hover:border-[var(--color-brand)] transition-colors flex items-center gap-1.5 enabled:active:scale-[0.96]"
            >
              <Target size={12} className="text-rose-500" />
              Goal Alignment
            </button>
          </div>
        )}

        {/* Input Bar */}
        {!showConfig && (
          <div className="p-4 border-t border-[var(--border-hairline)] bg-[var(--bg-surface-l2)]/60 backdrop-blur-md shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask Copilot or request action... (Cmd+J to toggle)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-strong)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-brand)] transition-all placeholder:text-[var(--text-muted)]"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-[var(--color-brand)] text-[var(--text-on-brand)] disabled:opacity-40 transition-all enabled:active:scale-[0.96]"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
};
