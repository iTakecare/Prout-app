import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Pipeline from "./pages/Pipeline";
import LeadDetailPage from "./pages/LeadDetail";
import Calculator from "./pages/Calculator";
import Substrates from "./pages/Substrates";

const NAV = [
  { to: "/", label: "Tableau de bord", icon: "📊", end: true },
  { to: "/pipeline", label: "Pipeline commercial", icon: "🗂️", end: false },
  { to: "/calculateur", label: "Calculateur méthanisation", icon: "🧮", end: false },
  { to: "/substrats", label: "Référentiel substrats", icon: "🌱", end: false },
];

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">♻️</div>
          <div>
            <strong>Méthascore</strong>
            <span>Waste-end CRM</span>
          </div>
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
          >
            <span>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          Estimation du potentiel de méthanisation des déchets organiques et
          pilotage commercial du lead à l'après-vente.
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/calculateur" element={<Calculator />} />
          <Route path="/substrats" element={<Substrates />} />
        </Routes>
      </main>
    </div>
  );
}
