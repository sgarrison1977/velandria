import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "@/pages/AuthPage";
import CharacterSelect from "@/pages/CharacterSelect";
import GamePage from "@/pages/GamePage";

const Guard = ({ children }) => (localStorage.getItem("sx_token") ? children : <Navigate to="/" replace />);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/characters" element={<Guard><CharacterSelect /></Guard>} />
        <Route path="/play/:charId" element={<Guard><GamePage /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
