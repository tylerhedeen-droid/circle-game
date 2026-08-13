import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles.css'
import './enhancements.css'
import './room-home.css'
let applyServiceWorkerUpdate: (reloadPage?: boolean) => Promise<void>
applyServiceWorkerUpdate = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('circle:update-ready', { detail: () => applyServiceWorkerUpdate(true) }))
  },
})
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
