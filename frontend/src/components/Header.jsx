import ThemeToggle from "./ThemeToggle.jsx";

export default function Header({ user, onLogout }) {
  return (
    <header className="site-header">
      <ThemeToggle className="site-theme-toggle" />

      <div className="brand" aria-label="Illuminux General Merch Company">
        <span className="brand-name">
          <span className="brand-accent">I</span>LLUMINUX
        </span>
        <span className="brand-line" />
        <span className="brand-subtitle">GENERAL MERCH CO.</span>
      </div>

      <img
        src="/illuminux-logo.png"
        className="header-logo"
        alt="Illuminux General Merch Company logo"
      />

      {user && (
        <div className="header-session">
          <span className="header-user" title={`Logged in as ${user.username}`}>
            {user.username} · {user.role}
          </span>
          <button className="logout-button" type="button" onClick={onLogout}>
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
