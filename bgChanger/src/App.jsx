import { useState } from 'react'
import './App.css'

function App() {
  const [color, setColor] = useState("white")

  return (
    <div 
      className="w-full  min-h-screen flex flex-col items-center justify-center duration-200"
      style={{ backgroundColor: color }}
    >
      <h1 className="text-2xl mb-4 font-bold">BG CHANGER</h1>

      <input
        type="text"
        placeholder="Enter color (red, blue, #000, etc)"
        className="px-4 py-2 border rounded"
        onChange={(e) => setColor(e.target.value)}
      />
    </div>
  )
}

export default App