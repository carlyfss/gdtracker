import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { ApiUnauthorizedBridge } from './components/ApiUnauthorizedBridge'
import { AuthRootProvider } from './context/AuthRootProvider'
import './index.css'

const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
        void updateSW(true)
    },
})

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <AuthRootProvider>
                <ApiUnauthorizedBridge />
                <App />
            </AuthRootProvider>
        </BrowserRouter>
    </StrictMode>
)
