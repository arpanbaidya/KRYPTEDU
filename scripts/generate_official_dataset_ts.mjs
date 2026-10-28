import fs from 'node:fs';
import Papa from 'papaparse';

const csv = fs.readFileSync('official_dataset.csv', 'utf8');
const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });

const departmentsMap = {
  'B.Tech Computer Engineering': 'Computer Engineering',
  'B.Tech Artificial Intelligence and Machine Learning': 'Artificial Intelligence and Machine Learning',
  'B.Tech Cyber security & Forensics': 'Cyber security & Forensics'
};

const processed = data.map((row, idx) => {
  const roll_no = (row['Registration Id'] || '').trim();
  const name = (row['Name'] || '').trim();
  const email = (row['Email'] || '').trim();
  const programme = (row['Programme'] || '').trim();
  const department = departmentsMap[programme] || programme;
  const section = (row['Programme Section'] || '').trim();
  const gender = (row['Gender'] || '').trim();
  const quota = (row['Quota'] || '').trim();
  const phone = (row[''] || '').trim();

  return {
    roll_no,
    name,
    email,
    department,
    programme,
    year: 1,
    batch_year: 2024,
    gender,
    quota,
    section,
    phone
  };
});

const tsCode = `/**
 * Authoritative Official Dataset imported from Google Sheet:
 * https://docs.google.com/spreadsheets/d/1rPyoy2ORmsyf703dsrrZ7ftirjlPonNwW_I1wZb_0yM/edit?usp=drivesdk
 * Total Records: ${processed.length}
 */

export interface OfficialStudentRecord {
  roll_no: string;
  name: string;
  email: string;
  department: "Computer Engineering" | "Artificial Intelligence and Machine Learning" | "Cyber security & Forensics";
  programme: string;
  year: number;
  batch_year: number;
  gender: string;
  quota: string;
  section: string;
  phone: string;
}

export const CANONICAL_DEPARTMENTS = [
  "Computer Engineering",
  "Artificial Intelligence and Machine Learning",
  "Cyber security & Forensics",
] as const;

export type CanonicalDepartment = (typeof CANONICAL_DEPARTMENTS)[number];

export const OFFICIAL_STUDENTS: OfficialStudentRecord[] = ${JSON.stringify(processed, null, 2)};
`;

fs.writeFileSync('src/lib/official-dataset.ts', tsCode, 'utf8');
console.log('Successfully generated src/lib/official-dataset.ts with', processed.length, 'students.');
