import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Router from './Router'
import { ModeProvider } from './context/ModeContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModeProvider>
      <Router />
    </ModeProvider>
  </StrictMode>,
)
