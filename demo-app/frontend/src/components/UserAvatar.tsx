import { useEffect, useState } from "react";
import { T } from "../theme";
import { fetchAvatarBlobUrl } from "../features/iam/api";

function initialsOf(name?: string | null, email?: string): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

// Poza de profil (dacă există) sau un cerc cu inițiale (fallback), la fel ca în orice app
// real — nu presupune că toată lumea are o poză încărcată. `hasAvatar` (din /me sau
// /users) evită o cerere inutilă către server pentru un cont fără poză.
export function UserAvatar({
  userId,
  name,
  email,
  hasAvatar,
  size = 36,
}: {
  userId: string;
  name?: string | null;
  email?: string;
  hasAvatar?: boolean;
  size?: number;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAvatar) { setUrl(null); return; }
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchAvatarBlobUrl(userId).then((u) => {
      if (cancelled) return;
      objectUrl = u;
      setUrl(u);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [userId, hasAvatar]);

  if (url) {
    return <img src={url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: T.brandTint,
        color: T.brandDark,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initialsOf(name, email)}
    </div>
  );
}
