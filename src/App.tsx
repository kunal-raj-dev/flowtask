import { DiagnosticsRuntime } from './components/settings/DiagnosticsRuntime';
import { UpdateNotice } from './components/workflow/UpdateNotice';
import { FocusRuntime } from './components/focus/FocusRuntime';
import { AppearanceRuntime } from './components/settings/AppearanceRuntime';
import { AuthProvider } from './context/AuthContext';
import { TaskProvider } from './context/TaskContext';
import { ModalProvider } from './context/ModalContext';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { MotionRuntime } from './components/settings/MotionRuntime';
import './styles/release-polish.css';
import './styles/workspace-responsive.css';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <TaskProvider>
          <ModalProvider>
            <MotionRuntime><FocusRuntime /><AppearanceRuntime /><DiagnosticsRuntime /><UpdateNotice /><AppLayout /></MotionRuntime>
          </ModalProvider>
        </TaskProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
