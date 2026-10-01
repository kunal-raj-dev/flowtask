import { TaskProvider } from './context/TaskContext';
import { AppLayout } from './components/layout/AppLayout';

function App() {
  return (
    <TaskProvider>
      <AppLayout />
    </TaskProvider>
  );
}

export default App;
