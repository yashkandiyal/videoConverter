import { useEffect } from "react"; 
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./components/ui/ToastProvider";
import Home from "./pages/Home";
import { socketService } from './services/socket';
import { getApiBaseURL } from './services/api'; 

/**
 * Root application component.
 *  • Initializes the WebSocket connection.
 *  • Sets up React-Router for navigation.
 *  • Wraps the app in the ToastProvider for global notifications.
 */
export default function App() {

  useEffect(() => {
    const devToken = "dev-token";

    // Call init() to create and configure the shared WebSocket connection.
    socketService.init(getApiBaseURL(), devToken);
    return () => {
      socketService.disconnect();
    };
  }, []);

  return (
    <Router>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </Router>
  );
}
