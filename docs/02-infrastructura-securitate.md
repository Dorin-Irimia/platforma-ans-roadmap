# Arhitectură hardware/cloud, integrare, securitate (secțiunile 4.6–4.11)

Sursă: Caiet de sarcini Platf. rev (1).pdf, paginile 148–250.

---

## 4.6 Arhitectură hardware/cloud (introducere)

- Arhitectură cloud-native: modularitate, separare componente, portabilitate, scalare controlată.
- Operare în Cloudul Privat Guvernamental (CPG), bazat pe Microsoft Azure Stack Hub; sistemul trebuie să fie complet compatibil cu această platformă.
- Licențe COTS în regim BYOL (Bring Your Own License), achiziționate de Prestator, în numele tenantului.
- Recomandare: imagini oficiale Azure Marketplace sau certificare de compatibilitate de la producător.
- Portabilitate: șabloane declarative (ARM templates sau echivalent), containere OCI, fără dependențe critice de servicii proprietare.
- Nu se achiziționează echipamente hardware dedicate — infrastructura e IaaS în CPG.
- Acoperire minimă: 36 luni de la finalizarea implementării (licențe, virtualizare, containerizare, orchestrare, monitorizare).
- Elasticitate/auto-scaling în limitele Azure Stack Hub; reziliență prin failover, replicare/redundanță multi-locație, criptare date în tranzit/repaus.

## 4.6.1 Platformă Cloud

Arhitectură minimă (2 noduri activ/pasiv, redundanță HA), cu load balancere redundante, servere aplicație, cluster căutare/indexare, cluster baze de date pe fiecare nod.

### Tabel dimensionare VM (cerințe minime obligatorii)

| Componentă | Nr. VM | Rol | CPU/VM | RAM/VM | Storage/VM |
|---|---|---|---|---|---|
| Aplicație DMS | 2 | Active+Passive | 6 vCPU | 12 GB | 300 GB SSD |
| Portal (intern+extern) | 2 | Active+Passive | 6 vCPU | 12 GB | 300 GB SSD |
| Bază de date | 2 | Primary+Replica | 6 vCPU | 24 GB | 1 TB SSD |
| BI | 2 | Active+Passive | 6 vCPU | 12 GB | 150 GB SSD |
| LMS | 1 | Standalone | 3 vCPU | 6 GB | 100 GB SSD |
| Tur virtual 3D | 1 | Standalone | 6 vCPU | 12 GB | 300 GB SSD |
| Chatbot | 1 | Standalone | 4 vCPU | 8 GB | 50 GB SSD |
| Servicii auxiliare | 2 | Procesare | 3 vCPU | 6 GB | 100 GB SSD |
| Resurse cache | 2 | Cache+sesiuni | 4 vCPU | 8 GB | 50 GB SSD |
| Load Balancer | 2 | Routing | 2 vCPU | 2 GB | 15 GB SSD |
| Monitoring | 1 | Observabilitate | 2 vCPU | 4 GB | 15 GB SSD |
| WAF Enterprise | 2 | WAF | 8 vCPU | 16 GB | 15 GB SSD |
| Cloud Firewall | 2 | Perimetru | 1 vCPU | 2 GB | 32 GB SSD |
| SIEM (nod central) | 1 | mgmt+analiză | 8 vCPU | 16 GB | 500 GB SSD |
| SIEM (colectare/indexare) | 1 | — | 4 vCPU | 16 GB | 250 GB SSD |
| Scanner vulnerabilități | 1 | — | 4 vCPU | 16 GB | 30 GB SSD |
| MDR Plus | 1 | — | 4 vCPU | 16 GB | 30 GB SSD |
| IAM (cluster security) | 3 | — | 8 vCPU | 32 GB | 300 GB SSD |

- Mediu Disaster Recovery activ-pasiv, separat complet de producție, dimensionat identic.
- 20 conexiuni VPN IPSec securizate (gateway dedicat, tunele IPSec, management acces).

## 4.6.2 Platformă de virtualizare

- Virtualizare Bare Metal (Tip 1), hipervizor direct pe hardware, suport multi-OS guest (Linux, Windows, BSD, CentOS).
- Izolare VM, administrare CLI+GUI, snapshot-uri/backup, compatibilitate Azure Stack Hub.
- Inventariere/descoperire automată resurse (Kubernetes/Terraform/API-uri infrastructură), sincronizare continuă stare resurse.
- Management multi-cloud/multi-cluster — registru centralizat clustere Kubernetes.
- Managementul workload-urilor containerizate: deployment-uri Kubernetes declarative (YAML/Helm), ConfigMaps/Secrets + integrare vault, suport FaaS, modul FinOps (cost per mediu/serviciu).

## 4.6.3 Continuitate operațională și Disaster Recovery (DR)

- Fluxuri de lucru declarative pentru DR: activare infrastructură rezervă, restaurare aplicații, reconectare BD, verificare funcțională.
- Failover/failback controlat, cu pași de validare automată și aprobare manuală.
- Obiective exemplificate: **RPO < 15 minute, RTO < 1 oră**.
- Testare periodică automatizată (ex. trimestrial), fără afectarea producției, rapoarte pentru audit.

## 4.6.4 Software de bază

| Componentă | Cantitate | Notă |
|---|---|---|
| Sistem operare desktop | 50 buc. | x64, min 128GB RAM (echipament), licență perpetuă, BitLocker, domain join |
| Suită de productivitate | 50 buc. | Licență perpetuă, on-premise, echivalentă 2021+ |
| Sistem operare Server | 2 buc. | Suport comercial ≥ 31.12.2029, Hyper-V/Docker/Kubernetes |
| Management centralizat IT | 1 pachet | Patch management, inventariere, RBAC/AD, izolare cloud public |
| SGBDR | 1 pachet | Criptare, restricționare acces, ERD, export CSV/XML/JSON |

## 4.6.5 Echipamente hardware individuale (enduser)

| Echipament | Cantitate | Specificații cheie |
|---|---|---|
| Desktop All-in-One | 50 buc. | Ultra 5, 16GB RAM DDR5, SSD 512GB, TPM 2.0, FIPS 140-2, MIL-STD 810H, garanție 36 luni NBD |
| Tablete rugged | 25 buc. | x86-64, NPU 40 TOPS, 16GB RAM, IP66, MIL-STD-810G/H, FIPS 140-2, garanție 24 luni |
| Imprimante departamentale | 3 buc. | A3 color, duplex, ADF 300 coli, garanție 24 luni, 2 persoane instruite service |
| Scanner performant | 1 buc. | 600dpi, 35ppm, 4000 pagini/zi, garanție 12 luni NBD |

---

## 4.7 Interconectare/interoperabilitate și accesibilitate

**Arhitectură API-first:**
- Backend complet decuplat de UI; toate funcționalitățile accesibile exclusiv prin API-uri.
- Suport REST, SOAP, GraphQL, gRPC; API REST documentat OpenAPI 3.x.
- API Gateway centralizat (autentificare/autorizare, rate limiting, logging, rutare).
- Securitate API: OAuth 2.0 + OpenID Connect, JWT, HTTPS/TLS, versionare backward-compatible.
- Integrare bidirecțională cu ITSM (tichete automate), CMDB (sincronizare resurse), webhook-uri.

**Interconectări obligatorii cu sisteme naționale:**
- Conformitate Legea 242/2022 și standardele NRRI (Ordinul MCID nr. 21286/26.10.2023).
- Interconectare cu ROeID (identificare/autentificare electronică).
- Interconectare cu PDURo/PCUe (Portalul Digital Unic al României), conform HG nr. 112/2023.

**Accesibilitate:** conform OUG 112/2018, standard minim WCAG 2.1 Level AA (încurajat AAA), EN 301 549. Declarație de accesibilitate publicată, evaluări periodice.

## 4.8 Cerințe generale aplicații web

- Funcții de accesibilitate (WCAG 2.1 AA, principii POUR).
- Interfață adaptată la dispozitiv: responsivitate, grile fluide, cross-browser, touch-friendly.

## 4.9 Cerințe aplicații software dezvoltate

- Licențiere nelimitată/perpetuă, transfer cod sursă (open-source MIT/Apache 2.0/GPLv3 sau COTS cu drept de proprietate).
- Suport tehnic minim 1 an inclus; mentenanță corectivă/evolutivă opțională minim 5 ani.
- Documentație tehnică completă, cod comentat, teste unitare/integrare/performanță, standarde de codare (PEP 8, PSR-12).

---

## 4.10 Securitatea sistemului

**Transversal:** testare penetrare (black box + white box) și audit tehnic terță parte obligatorii înainte de recepția finală; DLP; conformitate Reg. (UE) 2016/679; secure coding OWASP; segregare medii DEV/TEST/PREPROD/PROD; least privilege.

### 4.10.1 Managementul utilizatorilor și accesul la sistem
IdP centralizat (SSO, MFA, ciclu de viață utilizatori), ISO/IEC 27001, autentificare ROeID, Zero Trust. Protocoale: OAuth 2.0/OIDC, SAML 2.0, LDAP, RADIUS, SCIM 2.0. MFA: TOTP, WebAuthn/FIDO2/U2F, passkeys, OTP.

### 4.10.2 Securitate și conformitate
SSO, RBAC granular (CRUD+Execute), gestionare secrete (vault), audit complet (export SIEM), fluxuri autentificare configurabile cu MFA obligatoriu pentru roluri privilegiate.

### 4.10.3 Firewall cloud — 2 buc.
NGFW virtual, redundant (2 instanțe HA), L3-L7, IDS/IPS, VPN ≥25 conexiuni. Subscripție minim 36 luni.

### 4.10.4 Web Application Firewall (WAF) — 2 buc.
2 instanțe HA, protecție SQLi/XSS/OWASP, min. 1 Gbps/instanță. Subscripție minim 36 luni.

### 4.10.5 Servicii protecție DDoS
SaaS global, L3/L4/L7, WAF cloud OWASP Top 10, CDN inclus. SLA disponibilitate minim 99,9%, subscripție minim 36 luni.

### 4.10.6 Soluție MDR Plus / monitorizare 24/7
EDR minim 120 echipamente/VM-uri, licență 36 luni. ML zero-day, HyperDetect, sandbox cloud, SOC 24x7.

### 4.10.7 Soluție SIEM
Vulnerability Management (CVE), SIEM (corelare reguli), XDR. Suport minim 120 surse de loguri simultan.

### 4.10.8 Scanner vulnerabilități
Scanare externă CVE, autentificată/neautentificată. Drept utilizare minim 36 luni.

### 4.10.9 Servicii monitorizare MDR/SOC
Program 8x5, timp răspuns Next Business Day, raport lunar de securitate.

---

## 4.11 Confidențialitatea datelor

Conformitate GDPR (Reg. UE 2016/679) + Legea nr. 190/2018.

**Responsabilități Prestator:** analiza fluxurilor de date, RBAC, audit trail, backup/restaurare, criptare, funcționalități drepturi persoane vizate (export/rectificare/ștergere), suport tehnic DPIA (fără elaborare politici GDPR interne, fără desemnare DPO).

**Proprietate date:** date utilizatori interni = proprietate Achizitor; date utilizatori externi = proprietate proprie; Prestatorul nu dobândește drepturi asupra datelor.
