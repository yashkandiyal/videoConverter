import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { Toast, type ToastProps } from "./Toast";

interface ToastContextType {
    showToast: (message: string, options?: Omit<ToastProps, "message" | "onClose">) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// The hook that components will use
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
};

interface ToastState extends ToastProps {
    id: number;
}

// The provider that wraps your app
export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<ToastState[]>([]);

    const showToast = useCallback((message: string, options: Omit<ToastProps, "message" | "onClose"> = {}) => {
        const id = Date.now();
        setToasts((prevToasts) => [...prevToasts, { id, message, ...options }]);
    }, []);

    const handleClose = (id: number) => {
        setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    variant={toast.variant}
                    duration={toast.duration}
                    onClose={() => handleClose(toast.id)}
                />
            ))}
        </ToastContext.Provider>
    );
};
