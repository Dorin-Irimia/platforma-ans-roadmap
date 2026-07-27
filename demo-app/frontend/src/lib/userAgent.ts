// Etichetă scurtă, lizibilă (browser · SO) dintr-un string User-Agent brut — doar pentru
// afișare în lista de sesiuni active, nu detecție exhaustivă de dispozitiv.
export function describeUserAgent(ua?: string | null): string {
  if (!ua) return "Dispozitiv necunoscut";

  let browser = "Browser necunoscut";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = "Safari";

  let os = "";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return os ? `${browser} · ${os}` : browser;
}
