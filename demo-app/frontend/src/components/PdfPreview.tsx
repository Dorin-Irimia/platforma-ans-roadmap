import { useState, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { documentFileUrl, authHeaders, SignaturePlacementDto, SignaturePlacementInput } from "../features/dms/api";
import { T } from "../theme";
import { Button } from "./ui";

// Worker-ul pdf.js trebuie încărcat separat de thread-ul principal (randare PDF
// e costisitoare) — Vite rezolvă asset-ul acesta la build/dev prin `new URL(...)`.
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const STAMP_WIDTH_RATIO = 0.3;
const STAMP_HEIGHT_RATIO = 0.1;

interface Props {
  // Fie un document DMS (folosește ruta autentificată /documents/:id/file), fie un
  // fileUrl explicit (ex. un blob: URL deja rezolvat, ca la atașamentele Chatbot) —
  // acesta din urmă nu are nevoie de httpHeaders, e deja local în browser.
  documentId?: string;
  fileUrl?: string;
  existingPlacement?: SignaturePlacementDto;
  placementMode?: boolean;
  onPlace?: (placement: SignaturePlacementInput) => void;
  width?: number;
}

export function PdfPreview({ documentId, fileUrl, existingPlacement, placementMode, onPlace, width = 480 }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pendingBox, setPendingBox] = useState<SignaturePlacementInput | null>(null);
  const pageWrapperRef = useRef<HTMLDivElement>(null);

  const file = fileUrl ? fileUrl : { url: documentFileUrl(documentId!), httpHeaders: authHeaders() };

  const handlePageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!placementMode || !pageWrapperRef.current) return;
      const rect = pageWrapperRef.current.getBoundingClientRect();
      const clickXRatio = (e.clientX - rect.left) / rect.width;
      const clickYRatio = (e.clientY - rect.top) / rect.height;

      // Poziționăm ștampila centrată pe punctul de click, cu clamp la marginile paginii
      // (același comportament ca la plasarea unui câmp de semnătură în DocuSign/PandaDoc).
      const xRatio = Math.min(Math.max(clickXRatio - STAMP_WIDTH_RATIO / 2, 0), 1 - STAMP_WIDTH_RATIO);
      const yRatio = Math.min(Math.max(clickYRatio - STAMP_HEIGHT_RATIO / 2, 0), 1 - STAMP_HEIGHT_RATIO);

      const box: SignaturePlacementInput = {
        page: pageIndex,
        xRatio,
        yRatio,
        widthRatio: STAMP_WIDTH_RATIO,
        heightRatio: STAMP_HEIGHT_RATIO,
      };
      setPendingBox(box);
      onPlace?.(box);
    },
    [placementMode, pageIndex, onPlace]
  );

  const activeBox = pendingBox || (existingPlacement && existingPlacement.page === pageIndex ? existingPlacement : null);

  return (
    <div>
      <div
        ref={pageWrapperRef}
        onClick={handlePageClick}
        style={{
          position: "relative",
          display: "inline-block",
          cursor: placementMode ? "crosshair" : "default",
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <Document
          file={file}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={<div style={{ padding: 40, color: T.ink3, width, textAlign: "center" }}>Se încarcă previzualizarea...</div>}
          error={<div style={{ padding: 40, color: T.danger, width, textAlign: "center" }}>Nu am putut încărca documentul.</div>}
        >
          <Page pageNumber={pageIndex + 1} width={width} renderAnnotationLayer={false} renderTextLayer={false} />
        </Document>

        {activeBox && (
          <div
            style={{
              position: "absolute",
              left: `${activeBox.xRatio * 100}%`,
              top: `${activeBox.yRatio * 100}%`,
              width: `${activeBox.widthRatio * 100}%`,
              height: `${activeBox.heightRatio * 100}%`,
              border: `2px dashed ${T.brand}`,
              background: "rgba(255,107,26,0.10)",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: T.brand,
              pointerEvents: "none",
            }}
          >
            ✎ semnătură
          </div>
        )}
      </div>

      {numPages > 1 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setPageIndex((p) => Math.max(0, p - 1))}>
            ← Pagina anterioară
          </Button>
          <span style={{ fontSize: 12, color: T.ink3 }}>
            {pageIndex + 1} / {numPages}
          </span>
          <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setPageIndex((p) => Math.min(numPages - 1, p + 1))}>
            Pagina următoare →
          </Button>
        </div>
      )}
      {placementMode && (
        <p style={{ fontSize: 12, color: T.ink3, marginTop: 8 }}>
          Dă click pe document pentru a poziționa ștampila de semnătură.
        </p>
      )}
    </div>
  );
}
