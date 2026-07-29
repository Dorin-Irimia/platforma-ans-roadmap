import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlayCircle, GraduationCap } from "lucide-react";
import { Pill, Button } from "../../ui";
import { T } from "../../../theme";
import { fetchMyEnrollments, LmsMyEnrollmentDto } from "../../../features/lms/api";

function courseUrl(e: LmsMyEnrollmentDto): string {
  return `/lms/courses/${e.courseId}/learn${e.projectId ? `?projectId=${e.projectId}` : ""}`;
}

// Panoul principal — "reluare ultima lecție" + lecții recente, finalizate/în curs (pct.
// 14, experiența cursantului: reluare curs de unde a rămas). O singură cerere către
// GET /api/lms/my-enrollments, sortată deja server-side după ultima activitate.
export function ContinueLearningWidget() {
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<LmsMyEnrollmentDto[] | null>(null);

  useEffect(() => {
    fetchMyEnrollments().then(setEnrollments).catch(() => setEnrollments([]));
  }, []);

  if (enrollments === null) return <div style={{ color: T.ink3, fontSize: 13 }}>Se încarcă...</div>;

  if (enrollments.length === 0) {
    return (
      <div>
        <p style={{ color: T.ink3, fontSize: 13, marginTop: 0 }}>Nu ai început încă niciun curs.</p>
        <Button variant="ghost" onClick={() => navigate("/lms")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
          <GraduationCap size={14} /> Vezi proiectele disponibile
        </Button>
      </div>
    );
  }

  const [latest, ...rest] = enrollments;
  const latestDone = latest.progressPercent >= 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div
        onClick={() => navigate(courseUrl(latest))}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 14px",
          borderRadius: 12,
          background: T.brandTint,
          border: `1px solid ${T.brandTint2}`,
          cursor: "pointer",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.brandDark, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
            {latestDone ? "Ultimul curs parcurs" : "Continuă de unde ai rămas"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {latest.course.title}
          </div>
          {latest.currentLessonTitle && (
            <div style={{ fontSize: 12, color: T.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {latest.currentLessonTitle}
            </div>
          )}
        </div>
        <PlayCircle size={22} color={T.brand} style={{ flexShrink: 0 }} />
      </div>

      {rest.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Lecții recente
          </div>
          {rest.map((e) => (
            <div
              key={e.id}
              onClick={() => navigate(courseUrl(e))}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 10,
                background: T.line2,
                cursor: "pointer",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.course.title}
                </div>
                {e.currentLessonTitle && (
                  <div style={{ fontSize: 11, color: T.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.currentLessonTitle}
                  </div>
                )}
              </div>
              {e.progressPercent >= 100 ? (
                <Pill color={T.success} bg={T.successTint}>Finalizat</Pill>
              ) : (
                <Pill color={T.progress} bg={T.progressTint}>În curs</Pill>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
