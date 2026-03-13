import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { StudioApp } from './components/studio/StudioApp'
import { CollabDemoPage } from './components/collaboration/CollabDemoPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/collab" element={<CollabDemoPage />} />
        <Route path="*" element={<StudioApp />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
