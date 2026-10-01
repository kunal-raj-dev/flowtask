import { AuthProvider } from './context/AuthContext';
import { TaskProvider } from './context/TaskContext';
import { AppLayout } from './components/layout/AppLayout';

function App() {
  return (
    <AuthProvider>
      <TaskProvider>
        <AppLayout />
      </TaskProvider>
    </AuthProvider>
  );
}

export default App;
