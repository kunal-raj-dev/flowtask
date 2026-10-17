import { FeedbackForm } from "../settings/FeedbackForm";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Headphones,
  Clock3,
  Layers3,
} from "lucide-react";
import { BrandLogo } from "../ui/BrandLogo";
import { formatLocalDate } from '../../utils/nlpParser';
import "../../styles/welcome.css";

export function WelcomePage() {
  const handleLaunchGuestWorkspace = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const existing = localStorage.getItem('flowtask_tasks_v1');
      if (!existing || existing === '[]') {
        const today = formatLocalDate(new Date());
        const sampleTasks = [
          {
            id: `task-${Date.now()}-mit`,
            title: 'Welcome to FlowTask: Try Top 3 MIT planning',
            description: 'Focus on your three most meaningful tasks each day.',
            status: 'todo',
            priority: 'p1',
            projectId: 'inbox',
            plannedDate: today,
            topThreeDate: today,
            isPinnedToday: true,
            timeSpentMinutes: 0,
            subtasks: [],
            recurrence: 'none',
            tags: ['welcome'],
            contextTags: [],
            revision: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          {
            id: `task-${Date.now()}-focus`,
            title: 'Launch a 25-minute deep focus session',
            description: 'Click the timer button or press P on a highlighted task to enter Focus Studio.',
            status: 'todo',
            priority: 'p2',
            projectId: 'inbox',
            plannedDate: today,
            estimatedMinutes: 25,
            timeSpentMinutes: 0,
            subtasks: [],
            recurrence: 'none',
            tags: ['focus'],
            contextTags: [],
            revision: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          {
            id: `task-${Date.now()}-shortcut`,
            title: 'Press ? for keyboard shortcuts (try C & F in Focus Studio)',
            description: 'FlowTask is designed for keyboard speed without touching your mouse.',
            status: 'todo',
            priority: 'p3',
            projectId: 'inbox',
            plannedDate: today,
            timeSpentMinutes: 0,
            subtasks: [],
            recurrence: 'none',
            tags: ['shortcuts'],
            contextTags: [],
            revision: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ];
        localStorage.setItem('flowtask_tasks_v1', JSON.stringify(sampleTasks));
      }
      localStorage.setItem('flowtask_onboarding_completed', 'true');
    } catch {
      // Ignore storage write error in private modes
    }
    window.location.href = '/';
  };

  return (
    <div className="welcome-page">
      <header className="welcome-nav">
        <a href="/" aria-label="FlowTask home">
          <BrandLogo size={34} showWordmark />
        </a>
        <nav>
          <a href="#studio">The Studio</a>
          <a href="#privacy">Your data</a>
          <a className="welcome-link" href="/">
            Open FlowTask <ArrowUpRight size={16} />
          </a>
        </nav>
      </header>
      <main>
        <section className="welcome-hero">
          <div className="welcome-copy">
            <span className="welcome-eyebrow">
              <i />
              FLOWTASK 2.0 · FREE PUBLIC BETA
            </span>
            <h1>
              A little less rush.
              <br />A lot more <em>flow.</em>
            </h1>
            <p>
              Plan a day that fits. Pick the next small thing. Settle into a
              space that feels like yours.
            </p>
            <div className="welcome-cta">
              <a href="/" onClick={handleLaunchGuestWorkspace} className="welcome-guest-btn">
                Launch Guest Workspace <ArrowRight size={18} />
              </a>
              <span>Free to start. No account needed.</span>
            </div>
            <div className="welcome-proof">
              <span>
                <Check size={15} />
                Made for students & developers
              </span>
              <span>
                <Check size={15} />
                Works offline
              </span>
            </div>
          </div>
          <div
            className="welcome-room"
            role="img"
            aria-label="A warm study room with an example focus timer"
          >
            <div className="welcome-room-top">
              <span>RAINY WRITING</span>
              <span>YOUR FOCUS STUDIO</span>
            </div>
            <div className="welcome-room-center">
              <span>One paragraph at a time.</span>
              <strong>25:00</strong>
              <small>Take your time. You’re here.</small>
            </div>
            <div className="welcome-room-bottom">
              <Headphones size={16} />
              <span>Gentle rain · Soft piano</span>
              <i>01 / 03</i>
            </div>
          </div>
        </section>
        <section className="welcome-path">
          <span>A DAY WITH ROOM TO BREATHE</span>
          <div>
            <article>
              <small>01</small>
              <h2>Make room.</h2>
              <p>
                Choose your Top 3 and plan around the time you actually have.
              </p>
            </article>
            <article>
              <small>02</small>
              <h2>Find your somewhere.</h2>
              <p>
                A quiet library, a mountain morning, or your own favorite view.
              </p>
            </article>
            <article>
              <small>03</small>
              <h2>Do one thing.</h2>
              <p>
                Your task, next action and timer together. The rest can wait.
              </p>
            </article>
          </div>
        </section>
        <section id="studio" className="welcome-studio">
          <div>
            <span className="welcome-eyebrow">
              YOUR ENVIRONMENT. YOUR RHYTHM.
            </span>
            <h2>
              Somewhere you’ll
              <br />
              want to come back to.
            </h2>
            <p>
              Mix rain with a fireplace. Choose silence. Save your scene, sound
              and timer as a recipe, then start again in two actions.
            </p>
            <a href="/">
              Make yourself at home <ArrowUpRight size={17} />
            </a>
          </div>
          <div className="welcome-features">
            <article>
              <Layers3 />
              <h3>48 original places</h3>
              <p>
                Eight collections, personal uploads and optional motion scenes.
              </p>
            </article>
            <article>
              <Headphones />
              <h3>Your kind of quiet</h3>
              <p>
                Twelve ambient layers, offline noise and eighteen instrumental
                tracks.
              </p>
            </article>
            <article>
              <Clock3 />
              <h3>A rhythm that fits</h3>
              <p>Pomodoro, countdown, open-ended work and study sprints.</p>
            </article>
          </div>
        </section>
        <section id="privacy" className="welcome-privacy">
          <span className="welcome-eyebrow">
            A CALMER RELATIONSHIP WITH YOUR TO-DO LIST
          </span>
          <h2>Your work belongs to you.</h2>
          <p>
            Your core workspace stays on your device. An optional account syncs
            tasks, projects, finished focus history, recipes and safe
            preferences. Personal media, scratchpad contents and private
            calendar feed URLs stay local.
          </p>
          <p>
            Usage diagnostics are off by default and, when enabled, store only
            device-local event counts. Backups include your workspace data;
            personal media can be exported separately. You can delete your cloud
            account in Settings after signing in again.
          </p>
          <div>
            <a href="/media/audio/CREDITS.md">Audio credits ↗</a>
            <a href="/media/CREDITS.md">Artwork credits ↗</a>
          </div>
          <p className="welcome-small">
            The selected offline pack supports offline media. Your browser may
            clear device storage; keep a workspace backup. A configured Firebase
            account enables cloud sync.
          </p>
        </section>
        <section id="feedback" className="welcome-privacy">
          <FeedbackForm />
        </section>
        <section className="welcome-end">
          <span>ONE SMALL NEXT STEP.</span>
          <h2>Your day, with a little more room.</h2>
          <a href="/">
            Open FlowTask <ArrowRight size={18} />
          </a>
        </section>
      </main>
      <footer>
        <BrandLogo size={28} showWordmark />
        <a href="#feedback">Beta feedback ↗</a>
        <a href="/">Back to your day ↗</a>
      </footer>
    </div>
  );
}
