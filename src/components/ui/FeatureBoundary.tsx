import { Component, type ReactNode } from "react";
import { Dialog } from "./Dialog";

interface Props {
  children: ReactNode;
  title: string;
  onBack?: () => void;
  modal?: boolean;
  resetKey?: string;
}

/** A missing lazy chunk must never replace the planner or discard its running session. */
interface State {
  failed: boolean;
  resetKey?: string;
}
export class FeatureBoundary extends Component<Props, State> {
  state: State = { failed: false, resetKey: this.props.resetKey };
  static getDerivedStateFromProps(props: Props, state: State) {
    return props.resetKey !== state.resetKey
      ? { failed: false, resetKey: props.resetKey }
      : null;
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.warn("[FlowTask] A section could not load:", error.message);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const message = (
      <>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          This section could not load. If you are offline, connect and reload to
          download it. Your saved workspace and current focus session stay on
          this device.
        </p>
        <div className="flex flex-wrap gap-3 mt-5">
          {this.props.onBack && (
            <button className="desk-button" onClick={this.props.onBack}>
              {this.props.modal ? "Back to planner" : "Back to Today"}
            </button>
          )}
          <button
            className="desk-button primary"
            onClick={() => window.location.reload()}
          >
            Reload FlowTask
          </button>
        </div>
      </>
    );
    if (this.props.modal)
      return (
        <Dialog
          isOpen
          onClose={() => this.props.onBack?.()}
          title={this.props.title + " is unavailable"}
        >
          {message}
        </Dialog>
      );
    return (
      <section role="alert" className="p-6 sm:p-10 max-w-xl">
        <h1 className="text-xl font-semibold mb-3">
          {this.props.title} is unavailable
        </h1>
        {message}
      </section>
    );
  }
}
