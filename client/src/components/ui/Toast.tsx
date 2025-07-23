import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, AlertTriangle, Info, X } from "lucide-react";

export interface ToastProps {
  message: string;
  variant?: "success" | "error" | "info";
  duration?: number;
  onClose?: () => void;
}

const TOAST_VARIANTS = {
  success: {
    icon: <CheckCircle className="text-white" />,
    bg: "bg-emerald-500",
  },
  error: {
    icon: <AlertTriangle className="text-white" />,
    bg: "bg-red-600",
  },
  info: {
    icon: <Info className="text-white" />,
    bg: "bg-blue-500",
  },
};

export function Toast({
  message,
  variant = "info",
  duration = 4000,
  onClose,
}: ToastProps) {
  const [show, setShow] = useState(true);

  // Auto-close logic
  useEffect(() => {
    if (duration > 0) {
      const id = setTimeout(() => handleClose(), duration);
      return () => clearTimeout(id);
    }
  }, [duration]);

  const handleClose = () => {
    setShow(false);
  };

  // Call the parent onClose after the exit animation completes
  const handleExitComplete = () => {
    if (!show && onClose) onClose();
  };

  const portalRoot = document.getElementById("toast-root") || document.body;
  const variantStyles = TOAST_VARIANTS[variant];

  return ReactDOM.createPortal(
    <AnimatePresence onExitComplete={handleExitComplete}>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-4 px-6 py-4 rounded-xl text-white shadow-2xl ${variantStyles.bg}`}
        >
          {variantStyles.icon}
          <span className="font-semibold">{message}</span>
          <button onClick={handleClose} className="ml-4 -mr-2 text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    portalRoot
  );
}
