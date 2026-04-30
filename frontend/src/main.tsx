import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BrowserRouter>
            <App />
            <Toaster
                position="top-right"
                gutter={8}
                toastOptions={{
                    duration: 3500,
                    style: {
                        borderRadius: "10px",
                        background: "#1e293b",
                        color: "#f8fafc",
                        fontSize: "14px",
                        padding: "12px 16px",
                        boxShadow:
                            "0 10px 15px -3px rgba(0,0,0,0.3), 0 4px 6px -4px rgba(0,0,0,0.2)",
                    },
                    success: {
                        iconTheme: { primary: "#22c55e", secondary: "#fff" },
                    },
                    error: {
                        iconTheme: { primary: "#ef4444", secondary: "#fff" },
                    },
                }}
            />
        </BrowserRouter>
    </StrictMode>,
);
