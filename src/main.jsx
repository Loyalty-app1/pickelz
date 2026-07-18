import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import RoulettePage from "./RoulettePage.jsx";
import { AdminDashboard, AdminRewardsPage, AdminTitlesPage } from "./AdminPage.jsx";

// Routage par chemin (sans hash). Les liens font une vraie navigation ;
// sur GitHub Pages, 404.html (copie d'index.html) sert de fallback SPA.
function Router() {
  const base = import.meta.env.BASE_URL;
  let path = window.location.pathname;
  path = path.startsWith(base) ? path.slice(base.length) : path.replace(/^\//, "");
  path = path.replace(/\/+$/, "");

  if (path === "roulette") return <RoulettePage />;
  if (path === "admin") return <AdminDashboard />;
  if (path === "admin/recompenses") return <AdminRewardsPage />;
  if (path === "admin/titres") return <AdminTitlesPage />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);
