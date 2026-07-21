import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { T, RADIUS } from "../../../theme";
import { fetchWidgetImageBlobUrl } from "../../../features/dashboard/api";

export function CustomButtonWidget({ id, title, config, hasImage }: { id: string; title?: string | null; config?: Record<string, unknown> | null; hasImage: boolean }) {
  const url = (config?.url as string) || "";
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasImage) return;
    let objectUrl: string | null = null;
    fetchWidgetImageBlobUrl(id).then((u) => {
      objectUrl = u;
      setImgUrl(u);
    }).catch(() => {});
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, hasImage]);

  return (
    <button
      onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
      disabled={!url}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 90,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        background: T.line2,
        border: "none",
        borderRadius: RADIUS.md,
        cursor: url ? "pointer" : "not-allowed",
        overflow: "hidden",
      }}
    >
      {imgUrl ? (
        <img src={imgUrl} alt={title || "Buton personalizat"} style={{ width: 40, height: 40, objectFit: "contain" }} />
      ) : (
        <ImageOff size={24} color={T.ink4} />
      )}
      <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{title || "Buton personalizat"}</span>
    </button>
  );
}
