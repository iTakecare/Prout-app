import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Pipeline from "./pages/Pipeline";
import LeadDetailPage from "./pages/LeadDetail";
import Calculator from "./pages/Calculator";
import Substrates from "./pages/Substrates";
import Proposition from "./pages/Proposition";
import { Logo } from "./components/Logo";

const ICONS: Record<string, JSX.Element> = {
  dashboard: (
    <path d="M3 3h8v8H3zM13 3h8v5h-8zM13 11h8v10h-8zM3 13h8v8H3z" />
  ),
  pipeline: <path d="M3 4h5v16H3zM10 4h5v11h-5zM17 4h4v7h-4z" />,
  calc: (
    <path d="M5 3h14v18H5zM8.5 7.5h7M8.5 12h1M12 12h0M14.5 12h1M8.5 16h1M12 16h0M14.5 16h1" />
  ),
  leaf: <path d="M5 21C5 12 12 5 21 5c0 9-7 16-16 16zM5 21c3.5-4 7.5-7 12-9" />,
};

const NAV = [
  { to: "/", label: "Tableau de bord", icon: "dashboard", end: true },
  { to: "/pipeline", label: "Pipeline commercial", icon: "pipeline", end: false },
  { to: "/calculateur", label: "Calculateur", icon: "calc", end: false },
  { to: "/substrats", label: "Référentiel déchets", icon: "leaf", end: false },
];

function MainLayout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
              strokeLinecap="round"
            >
              {ICONS[n.icon]}
            </svg>
            {n.label}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          Estimation du potentiel de biométhanisation des déchets alimentaires
          et pilotage commercial, du lead à l'après-vente.
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

export default function App() {
  return (
    <Routes>
      <Route path="/proposition/:assessmentId" element={<Proposition />} />
      <Route path="*" element={<MainLayout />} />
    </Routes>
  );
}
