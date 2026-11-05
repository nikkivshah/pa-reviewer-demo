// Three synthetic prior authorization cases for an in-lab sleep study.
// SYNTHETIC DATA: NOT REAL PHI. All names, IDs, providers, and facilities are invented.
//
// Each case is a packet of several documents, the way requests really arrive
// (fax cover + referral letter + encounter note, or portal form + attachments).

import type { CriterionStatus } from "./schemas";

export type DocumentKind = "fax_cover" | "portal_form" | "referral_letter" | "encounter_note";

export type CaseDocument = {
  id: string;
  title: string;
  kind: DocumentKind;
  date: string;
  text: string;
};

export type SyntheticCase = {
  id: string;
  patientName: string;
  age: number;
  sex: "M" | "F";
  memberId: string;
  lineOfBusiness: "Medicare Advantage";
  intakeChannel: "fax" | "portal";
  priority: "standard" | "expedited";
  // How long before page load the request arrived. Relative so the TAT clock
  // always looks the same during a live demo.
  receivedHoursAgo: number;
  // Structured fields from the request itself (portal form or fax intake). The CPT
  // code drives criteria set selection.
  cptCode: string;
  // Date the request was submitted. Picks which criteria version was in effect.
  requestDate: string;
  requestedService: string;
  requestingProvider: string;
  documents: CaseDocument[];
  // QA only. Never sent to the model or the browser.
  expected: {
    criteria: Record<string, CriterionStatus>;
    recommendation: "approve" | "escalate";
    teachingPoint: string;
  };
};

const BANNER = "SYNTHETIC DATA: NOT REAL PHI";

// ---------------- Case 1: Mark T. ----------------

const MARK_DOCS: CaseDocument[] = [
  {
    id: "D1",
    title: "Fax cover sheet",
    kind: "fax_cover",
    date: "10/28/2026",
    text: `${BANNER}

==================== FAX TRANSMISSION ====================
FROM: Lakeview Internal Medicine        FAX: (512) 555-0142
TO: Utilization Management, Synthetic Health Plan (Medicare Advantage)
DATE: 10/28/2026
PAGES: 3 (including cover)
RE: PRIOR AUTHORIZATION REQUEST, SLEEP STUDY
==========================================================

Attached: referral letter (1 page), encounter note (1 page).
`,
  },
  {
    id: "D2",
    title: "Referral letter",
    kind: "referral_letter",
    date: "10/28/2026",
    text: `${BANNER}

REFERRAL LETTER

Date: 10/28/2026
Patient: Mark T.          DOB: 03/14/1966 (60 y/o male)
Member ID: SYN-MA-4410921
Referring provider: Dana Whitfield, MD, Internal Medicine (NPI 1999000011)
Requested service: Attended in-lab polysomnography (CPT 95810)
Diagnosis: Suspected obstructive sleep apnea (ICD-10 G47.33); essential hypertension, resistant (I10)
Rendering facility: Capitol Sleep Diagnostics

To the review team,

I am requesting an attended in-lab polysomnogram for Mr. T., a 60-year-old man with a strong clinical picture for obstructive sleep apnea and hypertension that remains uncontrolled despite three medications. Because of his poorly controlled blood pressure, I believe an attended study is more appropriate than a home test. Supporting encounter note attached.

Dana Whitfield, MD
`,
  },
  {
    id: "D3",
    title: "Encounter note",
    kind: "encounter_note",
    date: "10/21/2026",
    text: `${BANNER}

ENCOUNTER NOTE

Patient: Mark T.          DOB: 03/14/1966
Date of service: 10/21/2026
Visit type: Follow-up, established patient

Chief complaint: Loud snoring and feeling exhausted during the day.

HPI: Patient reports loud, nightly snoring for more than 5 years. His wife reports she has witnessed him stop breathing during sleep several times per week, followed by gasping. He describes excessive daytime sleepiness and has nodded off twice while stopped at red lights in the past month. He wakes unrefreshed most mornings and reports morning headaches.

PMH:
- Hypertension, diagnosed 2014, uncontrolled
- Hyperlipidemia
- Prediabetes

Medications:
- Amlodipine 10 mg daily
- Lisinopril 40 mg daily
- Hydrochlorothiazide 25 mg daily
- Atorvastatin 20 mg daily

Vitals: BP 156/94 (repeat 152/92). HR 78. Height 5'10". Weight 223 lb. BMI 32.0.

Exam:
- Neck circumference: 17.5 in
- Oropharynx: Mallampati class III, enlarged tongue base
- Lungs clear, heart regular rate and rhythm, no edema

Screening:
- STOP-BANG: 6/8 (Snoring, Tired, Observed apneas, Pressure, Age over 50, Gender male)
- Epworth Sleepiness Scale: 14

Assessment:
1. Suspected moderate to severe obstructive sleep apnea.
2. Resistant hypertension, above goal on 3 antihypertensive agents at maximal doses. Untreated OSA is a likely contributor.

Plan:
- Request attended in-lab polysomnography. Home testing not preferred given resistant hypertension.
- Counseled on sleep hygiene, avoiding alcohol within 3 hours of bedtime, and positional therapy (avoid sleeping on back). Referred to nutrition for weight management. Patient agreeable to all.
- Advised not to drive when drowsy until evaluated.
- Follow up after sleep study.

Electronically signed: Dana Whitfield, MD, 10/21/2026
`,
  },
];

// ---------------- Case 2: Sarah K. ----------------

const SARAH_DOCS: CaseDocument[] = [
  {
    id: "D1",
    title: "Portal submission form",
    kind: "portal_form",
    date: "10/29/2026",
    text: `${BANNER}

[Provider Portal Submission | Synthetic Health Plan | Medicare Advantage]
Submission ID: PRT-2026-118274
Submitted: 10/29/2026
Submitted by: Northgate Family Medicine
Member: Sarah K. (SYN-MA-7782035)
Service requested: CPT 95810, attended in-lab polysomnography
Priority: Standard
Attachments: referral_letter.pdf, visit_note_10-24-2026.pdf
`,
  },
  {
    id: "D2",
    title: "Referral letter",
    kind: "referral_letter",
    date: "10/29/2026",
    text: `${BANNER}

REFERRAL LETTER

Date: 10/29/2026
Patient: Sarah K.          DOB: 07/02/1972 (54 y/o female)
Member ID: SYN-MA-7782035
Referring provider: Luis Ortega, DO, Family Medicine (NPI 1999000027)
Requested service: Attended in-lab polysomnography (CPT 95810)
Diagnosis: Snoring (R06.83); fatigue (R53.83); essential hypertension (I10)

Requesting an in-lab sleep study for evaluation of possible sleep apnea. Patient reports snoring and fatigue. Please see attached visit note.

Luis Ortega, DO
`,
  },
  {
    id: "D3",
    title: "Visit note",
    kind: "encounter_note",
    date: "10/24/2026",
    text: `${BANNER}

VISIT NOTE

Patient: Sarah K.          DOB: 07/02/1972
Date of service: 10/24/2026
Visit type: Annual wellness visit with acute concern

Subjective: 54-year-old female here for annual wellness. Patient mentions her sister told her she snores loudly when they shared a room on vacation. She reports feeling very sleepy during the day, especially in the afternoons at work, and sometimes dozes off in meetings. She lives alone and no one has observed her breathing during sleep. Denies morning headaches.

PMH:
- Hypertension, diagnosed 2021
- Hypothyroidism, stable
- Seasonal allergies

Medications:
- Lisinopril 10 mg daily
- Levothyroxine 75 mcg daily
- Cetirizine 10 mg as needed

Vitals: BP 134/84. HR 72. Height 5'5". Weight 168 lb. BMI 28.0.

Exam:
- Neck circumference: 14.5 in
- Oropharynx: Mallampati class II
- Thyroid without nodules
- Heart and lungs normal

Screening:
- STOP-BANG: 4/8 (Snoring, Tired, Pressure, Age over 50)

Assessment:
1. Snoring with daytime sleepiness, rule out obstructive sleep apnea.
2. Hypertension, controlled on single agent.
3. Hypothyroidism, stable on current dose.

Plan:
- Refer for sleep study.
- Continue current medications.
- Routine labs: TSH, lipid panel, A1c.
- Return in 12 months or sooner as needed.

Electronically signed: Luis Ortega, DO, 10/24/2026
`,
  },
];

// ---------------- Case 3: Robert M. ----------------

const ROBERT_DOCS: CaseDocument[] = [
  {
    id: "D1",
    title: "Fax cover sheet",
    kind: "fax_cover",
    date: "10/30/2026",
    text: `${BANNER}

==================== FAX TRANSMISSION ====================
FROM: Eastside Primary Care Assoc.      FAX: (512) 555-0187
TO: UM Dept, Synthetic Health Plan (Medicare Advantage)
DATE: 10/30/2026
PAGES: 3 (including cover)
RE: PRIOR AUTH, POLYSOMNOGRAPHY
==========================================================

Attached: referral letter, encounter note.
`,
  },
  {
    id: "D2",
    title: "Referral letter",
    kind: "referral_letter",
    date: "10/30/2026",
    text: `${BANNER}

REFERRAL LETTER

Date: 10/30/2026
Patient: Robert M.          DOB: 11/19/1983 (42 y/o male)
Member ID: SYN-MA-3305617
Referring provider: Priya Raman, MD, Internal Medicine (NPI 1999000035)
Requested service: Attended in-lab polysomnography (CPT 95810)
Diagnosis: Snoring (R06.83)

Patient and his wife request a sleep study due to snoring. Patient prefers an in-lab study. Visit note attached.

Priya Raman, MD
`,
  },
  {
    id: "D3",
    title: "Encounter note",
    kind: "encounter_note",
    date: "10/27/2026",
    text: `${BANNER}

ENCOUNTER NOTE

Patient: Robert M.          DOB: 11/19/1983
Date of service: 10/27/2026
Visit type: Problem-focused

CC: Snoring.

HPI: 42-year-old male (Medicare Advantage via disability) presents at his wife's request. Wife reports he snores loudly most nights, disrupting her sleep. Wife has not observed any pauses in his breathing or gasping. Patient denies daytime sleepiness, says he feels rested on most mornings, and denies dozing while driving. No morning headaches.

PMH:
- Lumbar disc herniation (basis for disability), managed conservatively
- Seasonal allergic rhinitis

Medications:
- Fluticasone nasal spray daily
- Naproxen 500 mg as needed

Vitals: BP 124/78. HR 70. Height 6'0". Weight 191 lb. BMI 26.0.

Exam:
- Neck circumference: 15.5 in
- Oropharynx: Mallampati class II
- Mild nasal turbinate swelling
- Heart and lungs normal

Screening:
- STOP-BANG: 2/8 (Snoring, Gender male)
- Epworth Sleepiness Scale: 7

Assessment:
1. Primary snoring. Low pretest probability for obstructive sleep apnea.
2. Allergic rhinitis, may be contributing to snoring.

Plan:
- Discussed positional therapy, avoiding alcohol in the evening, and continued nasal steroid use. Patient declined a trial of positional therapy and prefers to proceed directly to testing.
- Discussed that a home sleep apnea test would be a reasonable first step given his low risk. Patient and wife prefer in-lab study. Will submit request.
- Follow up in 3 months.

Electronically signed: Priya Raman, MD, 10/27/2026
`,
  },
];

export const SYNTHETIC_CASES: SyntheticCase[] = [
  {
    id: "SYN-00001",
    patientName: "Mark T.",
    age: 60,
    sex: "M",
    memberId: "SYN-MA-4410921",
    lineOfBusiness: "Medicare Advantage",
    intakeChannel: "fax",
    priority: "standard",
    receivedHoursAgo: 3.2, // fresh, plenty of time
    cptCode: "95810",
    requestDate: "2026-10-28",
    requestedService: "In-lab polysomnography (CPT 95810)",
    requestingProvider: "Dana Whitfield, MD",
    documents: MARK_DOCS,
    expected: {
      criteria: { C1: "met", C2: "met", C3: "met", C4: "met", C5: "met", C6: "met" },
      recommendation: "approve",
      teachingPoint: "Clean case. Reviewer confirms in 1 to 2 minutes instead of reading from scratch.",
    },
  },
  {
    id: "SYN-00002",
    patientName: "Sarah K.",
    age: 54,
    sex: "F",
    memberId: "SYN-MA-7782035",
    lineOfBusiness: "Medicare Advantage",
    intakeChannel: "portal",
    priority: "standard",
    receivedHoursAgo: 4 * 24 + 6, // mid-window
    cptCode: "95810",
    requestDate: "2026-10-29",
    requestedService: "In-lab polysomnography (CPT 95810)",
    requestingProvider: "Luis Ortega, DO",
    documents: SARAH_DOCS,
    expected: {
      criteria: { C1: "met", C2: "met", C3: "missing", C4: "not_met", C5: "not_met", C6: "missing" },
      recommendation: "escalate",
      teachingPoint:
        "Mixed picture. AI separates 'not met' from 'missing', so the reviewer knows a Request Info could fix part of this.",
    },
  },
  {
    id: "SYN-00003",
    patientName: "Robert M.",
    age: 42,
    sex: "M",
    memberId: "SYN-MA-3305617",
    lineOfBusiness: "Medicare Advantage",
    intakeChannel: "fax",
    priority: "standard",
    receivedHoursAgo: 6 * 24 + 6.5, // ~17.5h left, triggers pre-breach alert
    cptCode: "95810",
    requestDate: "2026-10-30",
    requestedService: "In-lab polysomnography (CPT 95810)",
    requestingProvider: "Priya Raman, MD",
    documents: ROBERT_DOCS,
    expected: {
      criteria: { C1: "not_met", C2: "not_met", C3: "met", C4: "not_met", C5: "not_met", C6: "met" },
      recommendation: "escalate",
      teachingPoint:
        "Evidence clearly does not support in-lab PSG, and the AI still says ESCALATE, never deny. The clinician authors any denial.",
    },
  },
];

export function getCase(id: string): SyntheticCase | undefined {
  return SYNTHETIC_CASES.find((c) => c.id === id);
}
