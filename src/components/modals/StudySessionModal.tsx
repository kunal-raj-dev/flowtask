import React, { useState, useMemo } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import {
  parseStudySessions,
  type ParsedSession,
  type ParsedSessionTarget,
} from '../../utils/sessionParser';
import { formatLocalDate } from '../../utils/nlpParser';
import {
  BookOpen,
  Calendar,
  Clock,
  Sparkles,
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  Zap,
  Target,
  ArrowRight,
  Folder,
} from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import type { TargetDifficulty } from '../../types/task';

interface StudySessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSprint?: (taskId: string) => void;
  onLaunchSprint?: (taskId: string) => void;
}

const SAMPLE_STUDY_LOG = `Start Study - 8:30 AM
--------------------------------------------------
Session 01 - Time => 8:30 am to 11:30 am
task -> DSA question practise
target questions -> 7 HARDMedian of Two Sorted Arrayshttps://leetcode.com/problems/median-of-two-sorted-arrays Divide and Conquer
5MEDIUM3Sumhttps://leetcode.com/problems/3sum Array, Two Pointers, Sorting
11EASYLongest Common Prefixhttps://leetcode.com/problems/longest-common-prefix Array, String
8MEDIUMLongest Substring Without Repeating Charactershttps://leetcode.com/problems/longest-substring-without-repeating-characters String, Sliding Window
15MEDIUMContainer With Most Waterhttps://leetcode.com/problems/container-with-most-water Two Pointers
16EASYMajority Elementhttps://leetcode.com/problems/majority-element Array, Hash Table, Boyer-Moore Voting Algorithm
180 minutes / 6 questions => 30 mins/Q
--------------------------------------------------
Session 02 - Time => 12:00 pm to 2:30 pm
task -> Web development
target -> Day 25 -> Javascript complete module
finishing it then move to game activity
revision if possible starting from js after both done`;

const FORMAT_TEMPLATES = [
  {
    id: 'simple',
    label: '✨ Simple Format',
    content: `Session 1: DSA Practice (8:30am - 11:30am)
- Two Sum (Easy, 15m)
- 3Sum (Medium, 30m)
- Trapping Rain Water (Hard, 45m)

Session 2: Web Development (1:00pm - 3:30pm)
- JavaScript Async/Await module (45m)
- Build Quiz Game UI (60m)
- Review CSS Grid & Flexbox (25m)`,
  },
  {
    id: 'tasks',
    label: '📋 Quick Tasks',
    content: `- Two Sum (Easy, 15m)
- 3Sum (Medium, 30m)
- Trapping Rain Water (Hard, 45m)
- Code review and unit testing (30m)`,
  },
  {
    id: 'leetcode',
    label: '⚡ LeetCode Sprint',
    content: `Session 1: LeetCode Grind (9:00am - 12:00pm)
- 1. Two Sum (Easy, 15m) https://leetcode.com/problems/two-sum
- 15. 3Sum (Medium, 30m) https://leetcode.com/problems/3sum
- 42. Trapping Rain Water (Hard, 45m) https://leetcode.com/problems/trapping-rain-water
- 206. Reverse Linked List (Easy, 15m) https://leetcode.com/problems/reverse-linked-list`,
  },
  {
    id: 'chat',
    label: '💬 Chat Log',
    content: SAMPLE_STUDY_LOG,
  },
];

export const StudySessionModal: React.FC<StudySessionModalProps> = ({
  isOpen,
  onClose,
  onStartSprint,
  onLaunchSprint,
}) => {
  const launchSprint = onStartSprint || onLaunchSprint;
  const { addStudySessions, projects } = useTaskContext();

  const [activeTab, setActiveTab] = useState<'paste' | 'builder'>('paste');
  const [rawText, setRawText] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate(new Date()));
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    return projects.find((p) => p.id === 'work')?.id || projects[0]?.id || 'inbox';
  });

  // Visual builder state
  const [builderSessionNum, setBuilderSessionNum] = useState(1);
  const [builderTopic, setBuilderTopic] = useState('');
  const [builderStartTime, setBuilderStartTime] = useState('08:30');
  const [builderEndTime, setBuilderEndTime] = useState('11:30');
  const [builderTargets, setBuilderTargets] = useState<ParsedSessionTarget[]>([]);
  const [newTargetTitle, setNewTargetTitle] = useState('');
  const [newTargetUrl, setNewTargetUrl] = useState('');
  const [newTargetDiff, setNewTargetDiff] = useState<TargetDifficulty>('MEDIUM');
  const [newTargetTags, setNewTargetTags] = useState('');

  // Parsed sessions from text
  const parsedSessions = useMemo(() => {
    return parseStudySessions(rawText);
  }, [rawText]);

  const handleImportParsed = (startSprintImmediate = false) => {
    if (parsedSessions.length === 0) return;
    const createdTasks = addStudySessions(parsedSessions, selectedDate, selectedProjectId);
    onClose();
    if (startSprintImmediate && launchSprint && createdTasks[0]) {
      launchSprint(createdTasks[0].id);
    }
  };

  // Builder pacing calculation
  const builderDurationMins = useMemo(() => {
    const [sH, sM] = builderStartTime.split(':').map(Number);
    const [eH, eM] = builderEndTime.split(':').map(Number);
    let diff = (eH * 60 + eM) - (sH * 60 + sM);
    if (diff < 0) diff += 24 * 60;
    return diff;
  }, [builderStartTime, builderEndTime]);

  const builderPacing = useMemo(() => {
    if (builderTargets.length === 0 || builderDurationMins <= 0) return 0;
    return Math.round(builderDurationMins / builderTargets.length);
  }, [builderDurationMins, builderTargets.length]);

  const handleAddBuilderTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTargetTitle.trim()) return;

    const tags = newTargetTags
      .split(/[,•]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const newTarget: ParsedSessionTarget = {
      id: `builder-target-${Date.now()}`,
      title: newTargetTitle.trim(),
      difficulty: newTargetDiff,
      url: newTargetUrl.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    };

    setBuilderTargets((prev) => [...prev, newTarget]);
    setNewTargetTitle('');
    setNewTargetUrl('');
    setNewTargetTags('');
  };

  const handleRemoveBuilderTarget = (id: string) => {
    setBuilderTargets((prev) => prev.filter((t) => t.id !== id));
  };

  const handleImportBuilder = (startSprintImmediate = false) => {
    const session: ParsedSession = {
      id: `builder-session-${Date.now()}`,
      sessionNumber: builderSessionNum,
      sessionTopic: builderTopic,
      startTime: builderStartTime,
      endTime: builderEndTime,
      durationMinutes: builderDurationMins,
      targets: builderTargets,
      targetPacingMinutes: builderPacing,
      targetUnit: 'Q',
      rawText: `${builderTopic} (${builderStartTime} - ${builderEndTime})`,
    };

    const createdTasks = addStudySessions([session], selectedDate, selectedProjectId);
    onClose();
    if (startSprintImmediate && launchSprint && createdTasks[0]) {
      launchSprint(createdTasks[0].id);
    }
  };

  const getDifficultyBadge = (diff?: TargetDifficulty) => {
    if (diff === 'HARD') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
          HARD
        </span>
      );
    }
    if (diff === 'MEDIUM') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
          MED
        </span>
      );
    }
    if (diff === 'EASY') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
          EASY
        </span>
      );
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <BookOpen size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Study & Focus Sprint Planner
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Schedule time-blocked study sessions, LeetCode sprints, and automated question pacing
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between gap-3">
          <SegmentedControl<'paste' | 'builder'>
            items={[
              { id: 'paste', label: 'Paste Study Log' },
              { id: 'builder', label: 'Visual Session Builder' },
            ]}
            value={activeTab}
            onChange={(val) => setActiveTab(val)}
          />

          {/* Date & Project Selectors */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
              <Calendar size={12} className="text-amber-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs text-[var(--text-primary)] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
              <Folder size={12} className="text-indigo-500" />
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-transparent text-xs text-[var(--text-primary)] focus:outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* TAB 1: PASTE STUDY LOG */}
        {activeTab === 'paste' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Input Column */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span className="font-semibold uppercase tracking-wider text-[11px]">
                  Study Plan / Tasks Input
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Markdown & bullet points supported
                </span>
              </div>

              {/* Quick Format Template Selector */}
              <div className="flex flex-wrap items-center gap-1.5 pb-1">
                <span className="text-[11px] text-[var(--text-muted)] font-medium mr-0.5">Quick Formats:</span>
                {FORMAT_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setRawText(tmpl.content)}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-l3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] transition-all cursor-pointer"
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Enter in simple format:

Session 1: DSA Practice (8:30am - 11:30am)
- Two Sum (Easy, 15m)
- 3Sum (Medium, 30m)
- Trapping Rain Water (Hard, 45m)

Or simply paste a list of tasks:
- Task 1 (Easy, 20m)
- Task 2 (30m)`}
                rows={13}
                className="w-full p-3 font-mono text-xs rounded-xl bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none leading-relaxed placeholder:text-[var(--text-muted)]"
              />

              <p className="text-[11px] text-[var(--text-muted)] leading-snug">
                💡 <strong>Simple Format:</strong> Write <code>Session 1: Topic (8:30am - 11:30am)</code> followed by <code>- Task (Difficulty, 30m)</code>. Or just paste plain <code>- Task (mins)</code> bullet points!
              </p>
            </div>

            {/* Live Preview Column */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span className="font-semibold uppercase tracking-wider text-[11px]">
                  Detected Sessions ({parsedSessions.length})
                </span>
                {parsedSessions.length > 0 && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    Ready to schedule
                  </span>
                )}
              </div>

              <div className="max-h-[370px] overflow-y-auto space-y-3 pr-1">
                {parsedSessions.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-stone-300 dark:border-stone-800 text-center text-[var(--text-muted)] text-xs space-y-2">
                    <Sparkles size={24} className="text-amber-500 opacity-70" />
                    <span className="font-semibold text-[var(--text-primary)]">No sessions detected yet</span>
                    <p className="text-[11px] text-[var(--text-secondary)] max-w-xs leading-relaxed">
                      Write sessions like <code className="text-amber-600 dark:text-amber-400 font-mono">Session 1: DSA (9am - 12pm)</code> with <code className="text-amber-600 dark:text-amber-400 font-mono">- Two Sum (Easy, 15m)</code>, or simply paste bullet points!
                    </p>
                    <button
                      type="button"
                      onClick={() => setRawText(FORMAT_TEMPLATES[0].content)}
                      className="mt-1 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/25 text-xs font-semibold transition-all cursor-pointer"
                    >
                      Load Simple Template
                    </button>
                  </div>
                ) : (
                  parsedSessions.map((s, idx) => (
                    <div
                      key={s.id || idx}
                      className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] space-y-2.5 shadow-subtle"
                    >
                      {/* Session Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                              SESSION {String(s.sessionNumber || idx + 1).padStart(2, '0')}
                            </span>
                            <h4 className="text-xs font-bold text-[var(--text-primary)]">
                              {s.sessionTopic}
                            </h4>
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--text-secondary)]">
                            <span className="flex items-center gap-1">
                              <Clock size={11} className="text-indigo-500" />
                              {s.startTime && s.endTime
                                ? `${s.startTime} – ${s.endTime} (${s.durationMinutes}m)`
                                : `${s.durationMinutes || 0}m focus duration`}
                            </span>
                            {s.targetPacingMinutes && (
                              <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                                <Zap size={11} />
                                {s.targetPacingMinutes}m / {s.targetUnit || 'Q'}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-[11px] font-mono font-bold text-[var(--text-muted)]">
                          {s.targets.length} targets
                        </span>
                      </div>

                      {/* Targets List */}
                      {s.targets.length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-[var(--border-hairline)]">
                          {s.targets.map((target, tIdx) => (
                            <div
                              key={target.id || tIdx}
                              className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-xs"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {getDifficultyBadge(target.difficulty)}
                                {target.estimatedMinutes && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] border border-[var(--border-hairline)] shrink-0">
                                    {target.estimatedMinutes}m
                                  </span>
                                )}
                                <span className="font-medium text-[var(--text-primary)] truncate">
                                  {target.title}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {target.tags && target.tags.length > 0 && (
                                  <span className="hidden sm:inline-block text-[10px] text-[var(--text-muted)] truncate max-w-[120px]">
                                    {target.tags.join(', ')}
                                  </span>
                                )}
                                {target.url && (
                                  <a
                                    href={target.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 text-indigo-500 hover:text-indigo-600 rounded hover:bg-stone-200/50 dark:hover:bg-white/10 transition-colors"
                                    title="Open problem link"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Secondary & Contingency Milestones */}
                      {(s.secondaryMilestone || s.contingencyGoal) && (
                        <div className="pt-1.5 border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)] space-y-0.5">
                          {s.secondaryMilestone && (
                            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                              <ArrowRight size={11} />
                              <span>Next: {s.secondaryMilestone}</span>
                            </div>
                          )}
                          {s.contingencyGoal && (
                            <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                              <Target size={11} />
                              <span>Stretch: {s.contingencyGoal}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: VISUAL SESSION BUILDER */}
        {activeTab === 'builder' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Builder Configuration */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                    Session Number
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={builderSessionNum}
                    onChange={(e) => setBuilderSessionNum(parseInt(e.target.value, 10) || 1)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                    Session Theme / Subject
                  </label>
                  <input
                    type="text"
                    value={builderTopic}
                    onChange={(e) => setBuilderTopic(e.target.value)}
                    placeholder="e.g. DSA question practise"
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={builderStartTime}
                    onChange={(e) => setBuilderStartTime(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={builderEndTime}
                    onChange={(e) => setBuilderEndTime(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Add Target Item Form */}
              <form onSubmit={handleAddBuilderTarget} className="p-3 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] space-y-2">
                <span className="text-xs font-bold text-[var(--text-primary)] block">
                  Add Target Problem or Module
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={newTargetTitle}
                      onChange={(e) => setNewTargetTitle(e.target.value)}
                      placeholder="Title / # e.g. #3 Longest Substring"
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <select
                      value={newTargetDiff}
                      onChange={(e) => setNewTargetDiff(e.target.value as TargetDifficulty)}
                      className="w-full text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="EASY">EASY</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HARD">HARD</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="url"
                    value={newTargetUrl}
                    onChange={(e) => setNewTargetUrl(e.target.value)}
                    placeholder="URL e.g. https://leetcode.com/..."
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <input
                    type="text"
                    value={newTargetTags}
                    onChange={(e) => setNewTargetTags(e.target.value)}
                    placeholder="Tags e.g. Sliding Window, String"
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" variant="secondary" size="xs" leftIcon={<Plus size={12} />}>
                    Add Target
                  </Button>
                </div>
              </form>
            </div>

            {/* Builder Targets List & Pacer Readout */}
            <div className="space-y-3">
              {/* Dynamic Pacer Gauge */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-emerald-500/10 border border-amber-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                    Calculated Session Budget
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-base font-bold text-[var(--text-primary)]">
                      {builderDurationMins} mins
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">•</span>
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      ⚡ {builderPacing} mins/Q pacing
                    </span>
                  </div>
                </div>

                <span className="px-2 py-1 rounded-lg text-xs font-mono font-bold bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)]">
                  {builderTargets.length} items
                </span>
              </div>

              {/* Targets List */}
              <div className="max-h-[250px] overflow-y-auto space-y-1.5 pr-1">
                {builderTargets.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-xs text-[var(--text-muted)] border border-dashed border-stone-300 dark:border-stone-800 rounded-xl">
                    No target items added yet.
                  </div>
                ) : (
                  builderTargets.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getDifficultyBadge(t.difficulty)}
                        <span className="font-semibold text-[var(--text-primary)] truncate">
                          {t.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {t.url && (
                          <a
                            href={t.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-indigo-500 hover:text-indigo-600"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveBuilderTarget(t.id)}
                          className="p-1 text-stone-400 hover:text-rose-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Action Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border-hairline)]">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>

          {activeTab === 'paste' ? (
            <div className="flex items-center gap-2">
              {launchSprint && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={parsedSessions.length === 0}
                  onClick={() => handleImportParsed(true)}
                  leftIcon={<Zap size={14} className="text-amber-500 fill-amber-500" />}
                >
                  Schedule & Launch Sprint
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                disabled={parsedSessions.length === 0}
                onClick={() => handleImportParsed(false)}
                leftIcon={<Sparkles size={14} />}
              >
                Schedule {parsedSessions.length} Study Session{parsedSessions.length === 1 ? '' : 's'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {launchSprint && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={builderTargets.length === 0}
                  onClick={() => handleImportBuilder(true)}
                  leftIcon={<Zap size={14} className="text-amber-500 fill-amber-500" />}
                >
                  Schedule & Launch Sprint
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                disabled={builderTargets.length === 0}
                onClick={() => handleImportBuilder(false)}
                leftIcon={<Sparkles size={14} />}
              >
                Schedule Built Session
              </Button>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};
