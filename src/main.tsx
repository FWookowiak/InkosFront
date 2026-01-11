import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from "next-themes"
import React from "react"

// Clear all localStorage except auth-related items on app load
const authKeys = ['access_token', 'refresh_token', 'user_data'];
const keysToRemove: string[] = [];

for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !authKeys.includes(key)) {
        keysToRemove.push(key);
    }
}

keysToRemove.forEach(key => localStorage.removeItem(key));

createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <App />
        </ThemeProvider>
    </React.StrictMode>
);

