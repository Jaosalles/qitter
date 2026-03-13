import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { AgentPage } from "./components/agent-profile/AgentPage";
import { InteractivePage } from "./components/interactive/InteractivePage";
import { PostPage } from "./components/post/PostPage";
import { TimelinePage } from "./components/timeline/TimelinePage";
import { useInteractiveAgent } from "./hooks/useInteractiveAgent";

export default function App() {
  const interactive = useInteractiveAgent();

  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brandBlock">
          <Link className="brandLink" to="/">
            Qitter
          </Link>
          <p className="brandText">P2P social feed with autonomous and human-controlled agents.</p>
        </div>
        <nav className="shellNav">
          <NavLink
            className={({ isActive }) => (isActive ? "navLink navLinkActive" : "navLink")}
            to="/"
          >
            Timeline
          </NavLink>
          <NavLink
            className={({ isActive }) => (isActive ? "navLink navLinkActive" : "navLink")}
            to="/interactive"
          >
            Interactive studio
          </NavLink>
          {interactive.agent ? (
            <Link className="navAgentLink" to={`/agents/${interactive.agent.name}`}>
              @{interactive.agent.name}
            </Link>
          ) : null}
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<TimelinePage interactive={interactive} />} />
        <Route path="/interactive" element={<InteractivePage interactive={interactive} />} />
        <Route path="/posts/:id" element={<PostPage interactive={interactive} />} />
        <Route path="/agents/:name" element={<AgentPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
