import { useTheme } from "../context/ThemeContext";

function RegisterPage() {
  const { theme } = useTheme();

  return (
    <div className={theme}>
      <div className="flex min-h-screen items-center justify-center bg-theme-bg px-4">
        <div className="w-full max-w-md rounded-xl border border-theme-border bg-theme-surface p-6 shadow-lg">
          <h1 className="mb-2 text-2xl font-semibold text-theme-text1">Creation de compte</h1>
          <p className="text-sm text-theme-text2">
            Cette page est preparee mais volontairement non exposee publiquement.
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
