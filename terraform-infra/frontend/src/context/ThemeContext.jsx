import { createContext, useContext, useState, useEffect } from "react"
const ThemeContext = createContext()
export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") !== "light")
  useEffect(() => {
    localStorage.setItem("theme", dark ? "dark" : "light")
    document.body.style.background = dark ? "#070c18" : "#f0f4f8"
  }, [dark])
  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(p => !p) }}>
      {children}
    </ThemeContext.Provider>
  )
}
export const useTheme = () => useContext(ThemeContext)
