import { useEffect } from "react";
import { AuthPanel } from "./components/AuthPanel";
import { disconnectSocket } from "./lib/socket";
import { useAuthStore } from "./store/auth";
import { Dashboard } from "./views/Dashboard";

function App() {
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
    }
  }, [token]);

  return <main>{token ? <Dashboard /> : <AuthPanel />}</main>;
}

export default App;
