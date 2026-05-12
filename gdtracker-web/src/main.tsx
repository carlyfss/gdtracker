import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ApiUnauthorizedBridge } from './components/ApiUnauthorizedBridge'
import { AuthProvider } from './context/AuthContext'
import './index.css'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <ApiUnauthorizedBridge />
                <App />
            </AuthProvider>
        </BrowserRouter>
    </StrictMode>
)
