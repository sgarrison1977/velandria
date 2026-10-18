import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "@/pages/AuthPage";
import CharacterSelect from "@/pages/CharacterSelect";
import GamePage from "@/pages/GamePage";
import ModelGallery from "@/pages/ModelGallery";
import AdminPage from "@/pages/AdminPage";

const Guard = ({ children }) => (localStorage.getItem("sx_token") ? children : <Navigate to="/" replace />);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/characters" element={<Guard><CharacterSelect /></Guard>} />
        <Route path="/play/:charId" element={<Guard><GamePage /></Guard>} />
        <Route path="/gallery" element={<ModelGallery />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
