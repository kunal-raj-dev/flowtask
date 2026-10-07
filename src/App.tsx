import { AuthProvider } from './context/AuthContext';
import { TaskProvider } from './context/TaskContext';
import { ModalProvider } from './context/ModalContext';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <TaskProvider>
          <ModalProvider>
            <AppLayout />
          </ModalProvider>
        </TaskProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
