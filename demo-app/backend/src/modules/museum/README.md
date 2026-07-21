# Modul Galeria Marilor Sportivi — 4.5.7

- [x] Catalog artefacte (`MuseumArtifact`, upload fotografie prin `shared/storage.ts` — același tipar ca peste tot) — public (vitrină digitală) + admin (CRUD, STAFF_ROLES)
- [x] Bilete online cu cod QR real (`qrcode`, nu doar un string) — `POST /visits`
- [x] Capacitate maximă configurabilă per interval orar (`MuseumSettings.maxCapacityPerSlot`, nu hardcodată) — verificată înainte de a accepta o rezervare nouă (sumă `peopleCount` existent per `visitDate+timeSlot`)
- [x] Preț calculat automat (`MuseumSettings.ticketPriceRon` configurabil)
- [x] Check-in la poartă (`POST /visits/:ticketCode/checkin`) — închide bucla „cod unic", care altfel ar rămâne doar emis, niciodată verificat

## Scope cuts documentate explicit

Fără tur virtual/ghid audio/integrare Arhiva TVR/digitizare 3D/multilingvism RO+EN — necesită materiale media reale (fotografiere 2D/3D, înregistrări audio) și un parteneriat cu un radiodifuzor, nefezabil de construit într-un demo. Modulul acoperă catalogul + ticketing-ul, nu experiența muzeală digitală completă descrisă în caiet.
