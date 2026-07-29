import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, Plus } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader } from "../components/ui";
import { UserAvatar } from "../components/UserAvatar";
import { useToast } from "../components/ToastProvider";
import { useAuth } from "../features/iam/AuthContext";
import { useTranslation } from "../i18n/useTranslation";
import { LANGUAGES, LANGUAGE_LABELS, Language } from "../i18n/translations";
import {
  updateMe,
  uploadAvatar,
  deleteAvatar,
  changePassword,
  fetchMyVariables,
  createVariable,
  updateVariable,
  deleteVariable,
  UserVariableDto,
} from "../features/iam/api";
import { T } from "../theme";

function ProfileSection() {
  const { user, refresh } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleSaveName() {
    setSaving(true);
    try {
      await updateMe({ name: name.trim() || undefined });
      await refresh();
      toast.success(t("account.saved"));
    } finally {
      setSaving(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await uploadAvatar(file);
      await refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Eroare la încărcare");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveAvatar() {
    setUploading(true);
    try {
      await deleteAvatar();
      await refresh();
    } finally {
      setUploading(false);
    }
  }

  if (!user) return null;

  return (
    <Card>
      <SectionHeader title={t("account.profile")} />
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <UserAvatar userId={user.id} name={user.name} email={user.email} hasAvatar={user.hasAvatar} size={64} />
        <div style={{ display: "flex", gap: 8 }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
          <Button variant="ghost" disabled={uploading} onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
            <Upload size={13} /> {t("account.uploadPhoto")}
          </Button>
          {user.hasAvatar && (
            <Button variant="ghost" disabled={uploading} onClick={handleRemoveAvatar} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.danger }}>
              <Trash2 size={13} /> {t("account.removePhoto")}
            </Button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
        <div>
          <FieldLabel>{t("account.name")}</FieldLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div>
          <FieldLabel>{t("account.email")}</FieldLabel>
          <input value={user.email} disabled style={{ width: "100%", opacity: 0.6 }} />
        </div>
        <Button onClick={handleSaveName} disabled={saving} style={{ alignSelf: "flex-start", opacity: saving ? 0.6 : 1 }}>
          {t("account.save")}
        </Button>
      </div>
    </Card>
  );
}

function LanguageSection() {
  const { user, refresh } = useAuth();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  async function handleChange(language: Language) {
    setSaving(true);
    try {
      await updateMe({ language });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <SectionHeader title={t("account.language")} />
      <p style={{ fontSize: 12.5, color: T.ink3, marginTop: -8, marginBottom: 14 }}>{t("account.languageHelp")}</p>
      <select value={user?.language || "ro"} disabled={saving} onChange={(e) => handleChange(e.target.value as Language)} style={{ fontSize: 13.5, padding: "8px 12px" }}>
        {LANGUAGES.map((l) => (
          <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
        ))}
      </select>
    </Card>
  );
}

function SecuritySection() {
  const { t } = useTranslation();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (newPassword !== confirmPassword) {
      toast.error(t("account.passwordMismatch"));
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success(t("account.passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Eroare");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <SectionHeader title={t("account.security")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
        <div>
          <FieldLabel>{t("account.currentPassword")}</FieldLabel>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div>
          <FieldLabel>{t("account.newPassword")}</FieldLabel>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div>
          <FieldLabel>{t("account.confirmPassword")}</FieldLabel>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ width: "100%" }} />
        </div>
        <Button
          onClick={handleSubmit}
          disabled={saving || !currentPassword || !newPassword}
          style={{ alignSelf: "flex-start", opacity: saving ? 0.6 : 1 }}
        >
          {t("account.changePassword")}
        </Button>
      </div>
    </Card>
  );
}

function VariablesSection() {
  const { t } = useTranslation();
  const toast = useToast();
  const [variables, setVariables] = useState<UserVariableDto[]>([]);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetchMyVariables().then(setVariables).catch(() => setVariables([]));
  }
  useEffect(load, []);

  async function handleAdd() {
    setSaving(true);
    try {
      await createVariable({ key: key.trim(), label: label.trim(), value });
      setLabel(""); setKey(""); setValue(""); setAdding(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Eroare");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateValue(id: string, nextValue: string) {
    await updateVariable(id, { value: nextValue });
    load();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Ștergi această variabilă?")) return;
    await deleteVariable(id);
    load();
  }

  return (
    <Card>
      <SectionHeader title={t("account.variables")} />
      <p style={{ fontSize: 12.5, color: T.ink3, marginTop: -8, marginBottom: 14 }}>{t("account.variablesHelp")}</p>

      {variables.length === 0 && !adding && <p style={{ color: T.ink3, fontSize: 13 }}>{t("account.noVariables")}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        {variables.map((v) => (
          <div key={v.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, background: T.line2, borderRadius: 10 }}>
            <div style={{ width: 140, flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{v.label}</div>
              <div style={{ fontSize: 11, color: T.ink3 }}>{"{{" + v.key + "}}"}</div>
            </div>
            <input
              defaultValue={v.value}
              onBlur={(e) => e.target.value !== v.value && handleUpdateValue(v.id, e.target.value)}
              style={{ flex: 1, fontSize: 13 }}
            />
            <button onClick={() => handleDelete(v.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.danger, flexShrink: 0 }}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
          <div>
            <FieldLabel>{t("account.variableLabel")}</FieldLabel>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex. Semnătură" style={{ width: "100%" }} />
          </div>
          <div>
            <FieldLabel>{t("account.variableKey")}</FieldLabel>
            <input value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} placeholder="ex. semnatura" style={{ width: "100%" }} />
          </div>
          <div>
            <FieldLabel>{t("account.variableValue")}</FieldLabel>
            <textarea value={value} onChange={(e) => setValue(e.target.value)} style={{ width: "100%", minHeight: 60 }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={handleAdd} disabled={saving || !label.trim() || !key.trim()} style={{ opacity: saving ? 0.6 : 1 }}>
              {t("common.add")}
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>{t("common.cancel")}</Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setAdding(true)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
          <Plus size={13} /> {t("account.addVariable")}
        </Button>
      )}
    </Card>
  );
}

export default function AccountSettingsPage() {
  const { t } = useTranslation();
  return (
    <AppShell title={t("account.title")} subtitle={t("account.subtitle")}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 620 }}>
        <ProfileSection />
        <LanguageSection />
        <SecuritySection />
        <VariablesSection />
      </div>
    </AppShell>
  );
}
