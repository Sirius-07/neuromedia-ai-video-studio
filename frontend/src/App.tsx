import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { StudioApp } from './components/studio/StudioApp'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<StudioApp />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
