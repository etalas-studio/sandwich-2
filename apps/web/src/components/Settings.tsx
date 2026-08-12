import { useState, useEffect } from "react";
import { apiUrl } from "../api/base";
import { useLanguage, type Lang } from "../lib/i18n";
import AccountSection from "./AccountSection";
import type { Account } from "./AccountSection";

interface SettingsProps {
  onPurge?: () => void;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#111827",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "1rem",
  padding: "1.25rem",
  display: "flex",
  flexDirection: "column",
};

function LanguageCard() {
  const { lang, setLang, t } = useLanguage();
  const OPTIONS: { value: Lang; label: string }[] = [
    { value: "en", label: "English" },
    { value: "id", label: "Bahasa Indonesia" },
  ];
  return (
    <div style={cardStyle}>
      <p
        className="text-xs font-semibold uppercase tracking-widest mb-3"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        {t("settings_language")}
      </p>
      <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
        {t("settings_language_desc")}
      </p>
      <div
        className="flex rounded-lg overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLang(opt.value)}
            className="flex-1 px-3 py-2 text-xs font-medium transition-colors"
            style={
              lang === opt.value
                ? { backgroundColor: "#f91814", color: "#ffffff" }
                : {
                    backgroundColor: "transparent",
                    color: "rgba(255,255,255,0.5)",
                  }
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Settings({ onPurge }: SettingsProps) {
  const [account, setAccount] = useState<Account | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/account"), { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => setAccount(a as Account | null))
      .catch(() => {})
      .finally(() => setAccountLoading(false));
  }, []);

  const handleChangePassword = async (
    currentPassword: string,
    newPassword: string,
  ) => {
    const res = await fetch(apiUrl("/api/account/password"), {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      throw new Error(body.error ?? "Failed to change password");
    }
  };

  return (
    <div
      className="h-full overflow-y-auto p-8"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="mb-8">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "#111827" }}
        >
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: "#9ca3af" }}>
          Manage account preferences
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <LanguageCard />

        {accountLoading ? (
          <div style={cardStyle}>
            <div
              className="h-32 rounded-lg animate-pulse"
              style={{ backgroundColor: "rgba(0,0,0,0.04)" }}
            />
          </div>
        ) : account ? (
          <AccountSection
            account={account}
            onChangePassword={handleChangePassword}
            onPurge={onPurge}
          />
        ) : null}
      </div>
    </div>
  );
}
