import { useContext } from "react";
import { Play } from "lucide-react";
import { ModalContext } from "../../context/ModalContext";
import { useStudioPreferences } from "../../hooks/useStudio";
import { useTaskContext } from "../../context/TaskContext";
export function FocusLaunchpad() {
  const modal = useContext(ModalContext);
  const ctx = useTaskContext();
  if (!modal || !ctx.workspacePreferences) return null;
  return (
    <RecipesLaunchpad
      onOpen={(initialPhase) => modal.openModal("pomodoro", { initialPhase })}
    />
  );
}
function RecipesLaunchpad({
  onOpen,
}: {
  onOpen: (phase?: "focus" | "short_break" | "long_break") => void;
}) {
  const { recipes, update } = useStudioPreferences();
  const { focusSession, showToast } = useTaskContext();
  const choices = [
    ...recipes.filter((r) => r.favorite),
    ...recipes.filter((r) => !r.favorite),
  ].slice(0, 3);
  return (
    <section className="v2-launchpad" aria-label="Quick focus recipes">
      <span>Your way into flow</span>
      <div>
        {choices.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              if (focusSession) {
                showToast("Your current session is waiting in Studio.");
                onOpen();
                return;
              }
              update({
                recipeId: r.id,
                sceneId: r.sceneId,
                breakSceneId: r.breakSceneId || r.sceneId,
                layers: r.layers,
                musicId: r.musicId,
                musicVolume: r.musicVolume,
                timer: r.timer,
                taskSource: r.taskSource,
              });
              onOpen(r.initialPhase);
            }}
          >
            <Play size={12} />
            {r.name}
            <small>
              {r.timer.mode === "stopwatch"
                ? "Open-ended"
                : `${r.timer.focusMinutes} min`}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
