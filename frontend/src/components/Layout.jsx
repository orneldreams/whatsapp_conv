import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Bot,
  CalendarCheck,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Settings,
  Sun,
  X,
  UserCircle2,
  Users
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import { firestore } from "../services/firebase";

const links = [
  { to: "/", label: "Vue d'ensemble", icon: LayoutDashboard },
  { to: "/disciples", label: "Disciples", icon: Users },
  { to: "/suivi", label: "Suivi", icon: CalendarCheck },
  { to: "/discussions", label: "Discussions", icon: MessageSquare },
  { to: "/configuration", label: "Configuration", icon: Settings },
  { to: "/bot", label: "Bot", icon: Bot }
];

function getInitials(name) {
  if (!name) {
    return "?";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Layout({ title, subtitle = "", onLogout, children }) {
  const { theme, toggleTheme } = useTheme();
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [hasUnreadConversations, setHasUnreadConversations] = useState(false);
  const [unreadDiscussions, setUnreadDiscussions] = useState(0);

  const displayName = useMemo(() => {
    if (profile?.displayName) {
      return profile.displayName;
    }
    if (profile?.firstName || profile?.lastName) {
      return [profile.firstName, profile.lastName].filter(Boolean).join(" ");
    }
    if (user?.displayName) {
      return user.displayName;
    }
    if (user?.email) {
      return user.email;
    }
    return "Pasteur";
  }, [profile, user]);

  const activeLink = links.find((link) => link.label === title);
  const TitleIcon = activeLink?.icon;

  async function handleLogoutClick() {
    setMenuOpen(false);
    await onLogout?.();
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    let mounted = true;

    async function refreshUnread() {
      try {
        const res = await api.get("/api/conversations/unread-count");
        if (mounted) {
          setHasUnreadConversations(Boolean(res.data?.hasUnread));
          setUnreadDiscussions(Number(res.data?.unreadCount || 0));
        }
      } catch {
        if (mounted) {
          setHasUnreadConversations(false);
          setUnreadDiscussions(0);
        }
      }
    }

    const unsubscribe = onSnapshot(
      collection(firestore, "pasteurs", user?.uid || "", "disciples"),
      () => {
        refreshUnread();
      },
      () => {
        refreshUnread();
      }
    );

    refreshUnread();
    const interval = window.setInterval(refreshUnread, 15000);
    window.addEventListener("focus", refreshUnread);
    document.addEventListener("visibilitychange", refreshUnread);

    return () => {
      mounted = false;
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshUnread);
      document.removeEventListener("visibilitychange", refreshUnread);
    };
  }, [user?.uid]);

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
                onClick={() => {
                  setMobileNavOpen(false);
                  setMenuOpen(false);
                }}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "text-[#6C3FE8]"
                      : theme === "dark"
                        ? "text-[#9CA3AF] hover:text-white"
                        : "text-[#C4B5FD] hover:text-white"
                  }`
                }
              >
                <span className="relative inline-flex items-center">
                  <link.icon size={18} />
                  {link.to === "/disciples" && hasUnreadConversations ? (
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                  ) : null}
                  {link.to === "/discussions" && unreadDiscussions > 0 ? (
                    <span className="absolute -right-2.5 -top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                      {unreadDiscussions > 99 ? "99+" : unreadDiscussions}
                    </span>
                  ) : null}
                </span>
                <span>{link.label}</span>
              </NavLink>
            ))}
          </nav>
          <button
            onClick={handleLogoutClick}
            className="absolute bottom-6 left-5 inline-flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-[14px] font-medium text-[#F87171] transition-all duration-150 hover:bg-[rgba(248,113,113,0.15)] hover:text-[#FCA5A5]"
          >
            <LogOut size={18} />
            Deconnexion
          </button>
        </aside>

        {mobileNavOpen ? (
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="fixed inset-0 z-20 bg-black/40 lg:hidden"
            aria-label="Fermer le menu"
          />
        ) : null}

        <aside
          className={`fixed left-0 top-0 z-30 h-screen w-64 border-r border-theme-border bg-theme-sidebar p-5 text-white shadow-xl transition-transform duration-200 lg:hidden ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-[#6C3FE8] text-xs font-bold text-white">
                ✝
              </div>
              <h1 className="text-[16px] font-bold">DiscipLink</h1>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-md p-1 text-[#C4B5FD] hover:bg-white/10 hover:text-white"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="space-y-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => {
                  setMobileNavOpen(false);
                  setMenuOpen(false);
                }}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "text-[#6C3FE8]"
                      : theme === "dark"
                        ? "text-[#9CA3AF] hover:text-white"
                        : "text-[#C4B5FD] hover:text-white"
                  }`
                }
              >
                <span className="relative inline-flex items-center">
                  <link.icon size={18} />
                  {link.to === "/disciples" && hasUnreadConversations ? (
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                  ) : null}
                  {link.to === "/discussions" && unreadDiscussions > 0 ? (
                    <span className="absolute -right-2.5 -top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                      {unreadDiscussions > 99 ? "99+" : unreadDiscussions}
                    </span>
                  ) : null}
                </span>
                <span>{link.label}</span>
              </NavLink>
            ))}
          </nav>

          <button
            onClick={handleLogoutClick}
            className="absolute bottom-6 left-5 inline-flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-[14px] font-medium text-[#F87171] transition-all duration-150 hover:bg-[rgba(248,113,113,0.15)] hover:text-[#FCA5A5]"
          >
            <LogOut size={18} />
            Deconnexion
          </button>
        </aside>

        <header className="fixed left-0 right-0 top-0 z-10 border-b border-theme-border bg-theme-surface/95 px-4 py-3 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-theme-border text-theme-text2 lg:hidden"
                aria-label="Ouvrir le menu"
              >
                <Menu size={18} />
              </button>

              <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-theme-text1">
                {TitleIcon ? <TitleIcon size={20} className="text-[#6C3FE8]" /> : null}
                {title}
              </h2>
              {subtitle ? <p className="text-xs text-theme-text2">{subtitle}</p> : null}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text2"
              >
                {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
                {theme === "light" ? "Dark" : "Light"}
              </button>

              <div className="relative">
                <button
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-full border border-theme-border px-2 py-1"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                    {getInitials(displayName)}
                  </div>
                  <ChevronDown size={16} className="text-theme-text2" />
                </button>

                {menuOpen ? (
                  <div className="absolute right-0 top-12 z-20 w-56 rounded-xl border border-theme-border bg-theme-surface p-2 shadow-lg">
                    <div className="border-b border-theme-border px-2 pb-2">
                      <p className="text-sm font-semibold text-theme-text1">{displayName}</p>
                      <p className="text-xs text-theme-text2">{profile?.email || user?.email || ""}</p>
                    </div>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate("/profil");
                      }}
                      className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-theme-text1 hover:bg-theme-bg"
                    >
                      <UserCircle2 size={16} />
                      Profil
                    </button>
                    <button
                      onClick={handleLogoutClick}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-500 hover:bg-red-500/10"
                    >
                      <LogOut size={16} />
                      Deconnexion
                    </button>
                  </div>
                ) : null}
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
