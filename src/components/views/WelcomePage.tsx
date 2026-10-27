import { useState, useEffect } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  CheckCircle2,
  Headphones,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Sun,
  Inbox,
  CalendarDays,
  Folder,
  LockKeyhole,
  Code2,
  BookOpen,
  Circle,
  Star,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "../ui/BrandLogo";
import { FeedbackForm } from "../settings/FeedbackForm";
import { LandingUpdateNotice } from "../workflow/UpdateBanner";
import { FEATURED_ROOMS, roomImage } from "../../services/featuredRooms";
import { BUILD_ID, BUILD_LABEL } from "../../utils/buildInfo";
import "../../styles/welcome.css";

interface PreviewTask {
  id: number;
  title: string;
  duration: number;
  completed: boolean;
}

const INITIAL_PREVIEW_TASKS: PreviewTask[] = [
  { id: 1, title: "Understand one difficult concept", duration: 50, completed: false },
  { id: 2, title: "Build the first working version", duration: 40, completed: false },
  { id: 3, title: "Make time for a little reading", duration: 30, completed: false },
];

export function WelcomePage() {
  const [preview, setPreview] = useState<"plan" | "focus">("plan");
  const [room, setRoom] = useState<string>(FEATURED_ROOMS[0].id);
  const selectedRoom = FEATURED_ROOMS.find((r) => r.id === room)!;

  // Interactive Daily Desk preview state
  const [tasks, setTasks] = useState<PreviewTask[]>(INITIAL_PREVIEW_TASKS);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  // Interactive Focus Studio preview state
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = window.setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isTimerRunning]);

  const toggleTask = (id: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    setTasks((prev) => [
      ...prev,
      { id: Date.now(), title: trimmed, duration: 25, completed: false },
    ]);
    setNewTaskTitle("");
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const plannedHours = Math.round(
    tasks.reduce((sum, t) => sum + (t.completed ? 0 : t.duration), 0) / 60
  );

  return (
    <div className="welcome-page" data-build={BUILD_ID}>
      <a className="welcome-skip" href="#welcome-main">
        Skip to content
      </a>
      <header className="welcome-nav">
        <a href="/" aria-label="FlowTask home">
          <BrandLogo size={34} showWordmark />
        </a>
        <nav aria-label="Welcome navigation">
          <a href="#product">Product</a>
          <a href="#rooms">Focus Rooms</a>
          <a href="#privacy">Privacy</a>
          <a className="welcome-link" href="/app">
            Open FlowTask <ArrowUpRight size={16} />
          </a>
        </nav>
      </header>
      <main id="welcome-main">
        <section className="welcome-hero">
          <div className="welcome-copy">
            <span className="welcome-eyebrow">
              <span className="welcome-dot" /> LESS NOISE. MORE INTENTION.
            </span>
            <h1>
              Plan your day.
              <br />
              Enter your <em>flow.</em>
            </h1>
            <p>
              A clear plan. A quiet place. One meaningful thing at a time.
              <br className="welcome-desktop-break" /> Meet the workspace that
              makes room for your best work.
            </p>
            <div className="welcome-cta">
              <a href="/app" className="welcome-guest-btn">
                Continue to workspace <ArrowRight size={18} />
              </a>
              <span>Free public beta · No account needed</span>
            </div>
            <div className="welcome-proof">
              <span>
                <Check size={14} /> Built for students & developers
              </span>
              <span>
                <Check size={14} /> Local-first planning
              </span>
            </div>
          </div>
          <div className="welcome-showcase" id="product">
            <div className="welcome-showcase-bar">
              <span>
                <span className="welcome-dot" /> A LITTLE ROOM FOR YOUR DAY
              </span>
              <div role="group" aria-label="Product preview">
                <button
                  type="button"
                  aria-pressed={preview === "plan"}
                  onClick={() => setPreview("plan")}
                >
                  Plan (Daily Desk)
                </button>
                <button
                  type="button"
                  aria-pressed={preview === "focus"}
                  onClick={() => setPreview("focus")}
                >
                  Focus (Studio)
                </button>
              </div>
            </div>
            {preview === "plan" ? (
              <div
                className="welcome-plan-preview"
                aria-label="Example Daily Desk preview"
              >
                <aside className="welcome-preview-sidebar" aria-hidden="true">
                  <BrandLogo size={22} />
                  <span className="selected">
                    <Sun size={14} />
                    Today
                  </span>
                  <span>
                    <Inbox size={14} />
                    Inbox
                  </span>
                  <span>
                    <CalendarDays size={14} />
                    Plan
                  </span>
                  <span>
                    <Folder size={14} />
                    Projects
                  </span>
                  <span className="welcome-preview-studio">
                    <Headphones size={14} />
                    Focus Studio
                  </span>
                </aside>
                <div className="welcome-preview-day">
                  <div className="welcome-preview-title">
                    <div>
                      <small>YOUR DAILY DESK</small>
                      <h2>A day with intention.</h2>
                    </div>
                    <span>
                      {plannedHours}h planned · {Math.max(1, 6 - plannedHours)}h free
                    </span>
                  </div>
                  <div className="welcome-preview-next">
                    <span className="welcome-eyebrow">
                      <Sparkles size={11} className="welcome-accent-icon" /> UP NEXT · YOUR CHOICE
                    </span>
                    <h3>Make something meaningful.</h3>
                    <p>Start with the smallest useful step.</p>
                    <button type="button" onClick={() => setPreview("focus")}>
                      <Play size={12} fill="currentColor" />
                      Preview Focus
                    </button>
                  </div>
                  <div className="welcome-preview-tasks">
                    <div className="welcome-preview-tasks-header">
                      <span className="welcome-eyebrow">YOUR TOP 3 (INTERACTIVE)</span>
                      <span className="welcome-preview-tasks-count">
                        {tasks.filter((t) => t.completed).length} / {tasks.length} done
                      </span>
                    </div>
                    {tasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        className={`welcome-preview-task-item ${
                          task.completed ? "is-completed" : ""
                        }`}
                        onClick={() => toggleTask(task.id)}
                        aria-label={`Toggle task: ${task.title}`}
                        aria-pressed={task.completed}
                      >
                        {task.completed ? (
                          <CheckCircle2 size={15} className="welcome-task-check" />
                        ) : (
                          <Circle size={15} className="welcome-task-circle" />
                        )}
                        <span className="welcome-task-text">{task.title}</span>
                        <small>{task.duration}m</small>
                        <Star
                          size={12}
                          className={
                            task.completed ? "welcome-star-active" : "welcome-star-muted"
                          }
                        />
                      </button>
                    ))}
                  </div>
                  <form
                    className="welcome-preview-capture-form"
                    onSubmit={handleAddTask}
                  >
                    <Plus size={13} aria-hidden="true" />
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Add a task for today (press enter)..."
                      aria-label="Add a task to preview"
                      maxLength={80}
                    />
                  </form>
                </div>
                <aside className="welcome-preview-agenda">
                  <span className="welcome-eyebrow">YOUR AFTERNOON</span>
                  <div>
                    <small>14:00</small>
                    <p>
                      Deep work<em>Room to make progress</em>
                    </p>
                  </div>
                  <div>
                    <small>15:00</small>
                    <p>
                      A proper break<em>Step away. Come back fresh.</em>
                    </p>
                  </div>
                  <img
                    src={roomImage("alpine-mirror", true)}
                    alt=""
                    loading="lazy"
                    width="180"
                    height="95"
                  />
                  <p>Leave a little breathing room.</p>
                </aside>
              </div>
            ) : (
              <div
                className="welcome-focus-preview"
                style={{
                  backgroundImage: `linear-gradient(180deg,#111b2190,#111b2170),url("${roomImage(room)}")`,
                }}
                aria-label={`${selectedRoom.title} Focus preview`}
              >
                <div className="welcome-focus-ambient-badge">
                  <Headphones size={13} />
                  <span>{selectedRoom.title}</span>
                  <div
                    className={`welcome-soundwave ${isTimerRunning ? "active" : ""}`}
                    aria-hidden="true"
                    title="Auditory ambience indicator"
                  >
                    <span className="wave-bar bar-1" />
                    <span className="wave-bar bar-2" />
                    <span className="wave-bar bar-3" />
                    <span className="wave-bar bar-4" />
                  </div>
                </div>
                <span className="welcome-eyebrow">ONE THING AT A TIME</span>
                <h2>Make something meaningful.</h2>
                <strong className="welcome-focus-timer">
                  {formatTimer(timerSeconds)}
                </strong>
                <p>Your task. Your space. Your pace.</p>
                <div className="welcome-focus-action-row">
                  <button
                    type="button"
                    className="welcome-timer-toggle-btn"
                    onClick={() => setIsTimerRunning((r) => !r)}
                    aria-label={
                      isTimerRunning ? "Pause preview timer" : "Start preview timer"
                    }
                  >
                    {isTimerRunning ? (
                      <>
                        <Pause size={13} fill="currentColor" /> Pause Preview
                      </>
                    ) : (
                      <>
                        <Play size={13} fill="currentColor" /> Test Focus Timer
                      </>
                    )}
                  </button>
                  {timerSeconds !== 25 * 60 && (
                    <button
                      type="button"
                      className="welcome-timer-reset-btn"
                      onClick={() => {
                        setIsTimerRunning(false);
                        setTimerSeconds(25 * 60);
                      }}
                      aria-label="Reset timer"
                      title="Reset timer to 25:00"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                  <a href="/app" className="welcome-open-studio-link">
                    Open your Studio <ArrowUpRight size={13} />
                  </a>
                </div>
                <small className="welcome-focus-caption">
                  {isTimerRunning
                    ? "Demonstration timer ticking · No audio in preview"
                    : `${selectedRoom.mood} · Preview is silent`}
                </small>
              </div>
            )}
            <div className="welcome-preview-caption">
              <span>PLAN A LITTLE. FOCUS DEEPLY.</span>
              <span>
                Illustrative preview · Your workspace starts with your own
                tasks.
              </span>
            </div>
          </div>
        </section>
        <section className="welcome-path" aria-label="How FlowTask works">
          <article>
            <small>01 / MAKE ROOM</small>
            <h2>A realistic day.</h2>
            <p>
              Pick your Top 3. See what fits. Leave space for life between the
              tasks.
            </p>
          </article>
          <article>
            <small>02 / SETTLE IN</small>
            <h2>Your kind of quiet.</h2>
            <p>
              Choose a room, a rhythm and a soundscape. Silence is always an
              option.
            </p>
          </article>
          <article>
            <small>03 / GO A LITTLE DEEPER</small>
            <h2>One next step.</h2>
            <p>
              Keep your task, timer and next action together. Pick up where you
              left off.
            </p>
          </article>
        </section>
        <section id="rooms" className="welcome-rooms">
          <div className="welcome-section-heading">
            <div>
              <span className="welcome-eyebrow">A CHANGE OF SCENE</span>
              <h2>Find your somewhere.</h2>
            </div>
            <p>
              A rainy afternoon. A mountain morning.
              <br />A place that helps the rest fall quiet.
            </p>
          </div>
          <div className="welcome-room-grid">
            {FEATURED_ROOMS.map((r) => {
              const isSelected = room === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`welcome-room-card ${isSelected ? "is-active" : ""}`}
                  aria-label={`Preview ${r.title}`}
                  aria-pressed={preview === "focus" && isSelected}
                  onClick={() => {
                    setRoom(r.id);
                    setPreview("focus");
                    document
                      .getElementById("product")
                      ?.scrollIntoView?.({ block: "center", behavior: "smooth" });
                  }}
                >
                  <div className="welcome-room-image-wrap">
                    <img
                      src={roomImage(r.id)}
                      alt=""
                      loading="lazy"
                      width="480"
                      height="300"
                    />
                    {isSelected && (
                      <span className="welcome-room-active-pill">
                        Active in Preview
                      </span>
                    )}
                  </div>
                  <span className="welcome-room-info">
                    <small>{r.category}</small>
                    <strong>
                      {r.title}
                      <ArrowUpRight size={17} />
                    </strong>
                    <em>{r.mood}</em>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="welcome-for">
          <div>
            <BookOpen size={25} />
            <span className="welcome-eyebrow">FOR STUDENTS</span>
            <h2>
              Less overwhelm.
              <br />
              More understanding.
            </h2>
            <p>
              Turn a syllabus into manageable study sessions. Keep your next
              problem, reference and focus timer within reach.
            </p>
          </div>
          <div>
            <Code2 size={25} />
            <span className="welcome-eyebrow">FOR DEVELOPERS</span>
            <h2>
              From a long backlog
              <br />
              to one good next step.
            </h2>
            <p>
              Plan realistic blocks, keep projects moving and save the context
              you need to return to deep work.
            </p>
          </div>
        </section>
        <section id="privacy" className="welcome-privacy">
          <LockKeyhole size={26} />
          <span className="welcome-eyebrow">YOUR SPACE, ON YOUR TERMS</span>
          <h2>Your work belongs to you.</h2>
          <p>
            Start without an account. Core planning stays on your device, with
            optional cloud sync and exportable backups. Personal media and
            scratchpad contents stay local.
          </p>
          <p className="welcome-small">
            Offline planning is available after the app loads. Download a media
            pack for offline scenes and sound. Browser storage can be cleared;
            keep a backup of important work.
          </p>
          <div>
            <a href="/media/audio/CREDITS.md">Audio credits ↗</a>
            <a href="/media/CREDITS.md">Artwork credits ↗</a>
          </div>
        </section>
        <section className="welcome-end">
          <span className="welcome-eyebrow">YOUR NEXT SMALL STEP</span>
          <h2>
            A little less rush.
            <br />A lot more room.
          </h2>
          <a href="/app">
            Open FlowTask <ArrowRight size={18} />
          </a>
        </section>
        <details id="feedback" className="welcome-feedback">
          <summary>Help shape the beta</summary>
          <FeedbackForm />
        </details>
      </main>
      <footer>
        <a href="/" aria-label="FlowTask home">
          <BrandLogo size={27} showWordmark />
        </a>
        <span>Plan your day. Enter your flow.</span>
        <a href="/help">Help</a><a href="/privacy">Privacy</a><a href="/data-retention">Data retention</a><a href="#feedback">Feedback ↗</a>
        <span className="welcome-build" title={BUILD_ID}>
          Build {BUILD_LABEL}
        </span>
      </footer>
      <LandingUpdateNotice />
    </div>
  );
}
