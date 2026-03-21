import { NavLink } from "react-router-dom";
import {
  Bot,
  CalendarCheck,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Sun,
  Users
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const links = [
  { to: "/", label: "Vue d'ensemble", icon: LayoutDashboard },
  { to: "/disciples", label: "Disciples", icon: Users },
  { to: "/suivi", label: "Suivi", icon: CalendarCheck },
  { to: "/configuration", label: "Configuration", icon: Settings },
  { to: "/bot", label: "Bot", icon: Bot }
];

function Layout({ title, onLogout, children }) {
  const { theme, toggleTheme } = useTheme();
  const activeLink = links.find((link) => link.label === title);
  const TitleIcon = activeLink?.icon;

  return (
    <div>
      <div className="min-h-screen bg-theme-bg text-theme-text1">
        <aside className="fixed left-0 top-0 hidden h-screen w-60 border-r border-theme-border bg-theme-sidebar p-5 text-white lg:block">
          <div className="mb-8 flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-[#6C3FE8] text-xs font-bold text-white">
              ✝
            </div>
            <h1 className="text-[16px] font-bold">DiscipLink</h1>
          </div>
          <nav className="space-y-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive ? "text-[#6C3FE8]" : "text-[#9CA3AF] hover:text-white"
                  }`
                }
              >
                <link.icon size={18} />
                {link.label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={onLogout}
            className="absolute bottom-6 left-5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#9CA3AF] transition-colors hover:text-white"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </aside>

        <header className="fixed left-0 right-0 top-0 z-10 border-b border-theme-border bg-theme-surface/95 px-4 py-3 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-theme-text1">
              {TitleIcon ? <TitleIcon size={20} className="text-[#6C3FE8]" /> : null}
              {title}
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text2"
              >
                {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
                {theme === "light" ? "Dark" : "Light"}
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                PK
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 pb-6 pt-20 lg:ml-60 lg:px-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
