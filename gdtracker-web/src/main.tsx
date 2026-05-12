import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { ApiUnauthorizedBridge } from './components/ApiUnauthorizedBridge'
import { AuthProvider } from './context/AuthContext'
import './index.css'

registerSW({ immediate: true })

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
