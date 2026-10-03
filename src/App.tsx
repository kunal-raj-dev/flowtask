import { AuthProvider } from './context/AuthContext';
import { TaskProvider } from './context/TaskContext';
import { ModalProvider } from './context/ModalContext';
import { AppLayout } from './components/layout/AppLayout';

function App() {
  return (
    <AuthProvider>
      <TaskProvider>
        <ModalProvider>
          <AppLayout />
        </ModalProvider>
      </TaskProvider>
    </AuthProvider>
  );
}

export default App;
