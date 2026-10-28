import fs from 'node:fs';
import Papa from 'papaparse';

const csvContent = fs.readFileSync('official_dataset.csv', 'utf8');
const { data, errors } = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

console.log('Total parsed rows:', data.length);
if (errors.length > 0) {
  console.log('Parse errors:', errors);
}

// Canonical departments mapping
// In the source sheet:
// Column 'Programme' has:
// 1. 'B.Tech Computer Engineering' (157 rows)
// 2. 'B.Tech Artificial Intelligence and Machine Learning' (99 rows)
// 3. 'B.Tech Cyber security & Forensics' (19 rows)
// Column 'Department' has 'Universal College of Engineering' for all rows.

// In university structures, the department is:
// - Computer Engineering
// - Artificial Intelligence and Machine Learning
// - Cyber security & Forensics

const departmentsMap = {
  'B.Tech Computer Engineering': 'Computer Engineering',
  'B.Tech Artificial Intelligence and Machine Learning': 'Artificial Intelligence and Machine Learning',
  'B.Tech Cyber security & Forensics': 'Cyber security & Forensics'
};

const students = [];
const seenIds = new Set();
const seenEmails = new Set();
const duplicates = [];

for (const [idx, row] of data.entries()) {
  const regId = (row['Registration Id'] || '').trim();
  const name = (row['Name'] || '').trim();
  const email = (row['Email'] || '').trim();
  const programme = (row['Programme'] || '').trim();
  const rawDept = (row['Department'] || '').trim();
  const batchYear = parseInt(row['Batch Year'] || '2024', 10);
  const gender = (row['Gender'] || '').trim();
  const quota = (row['Quota'] || '').trim();
  const section = (row['Programme Section'] || '').trim();
  const phone = (row[''] || '').trim();

  // Check unique ID
  if (seenIds.has(regId)) {
    duplicates.push({ type: 'regId', value: regId, row: idx + 1 });
  }
  seenIds.add(regId);

  // Department normalization
  const dept = departmentsMap[programme] || programme;

  students.push({
    roll_no: regId,
    name,
    email,
    department: dept,
    programme,
    institution: rawDept,
    year: 1, // Batch 2024, Graduating 2028
    batch_year: batchYear,
    gender,
    quota,
    section,
    phone,
    // Indicators from dataset: Not provided in source sheet
    cgpa: null,
    attendance: null,
    lms_activity: null,
    engagement: null,
    placement_readiness: null,
    skills_score: null,
    feedback_score: null,
    backlogs: null
  });
}

console.log('Total valid student records:', students.length);
console.log('Duplicates found:', duplicates.length);

const deptCounts = {};
for (const s of students) {
  deptCounts[s.department] = (deptCounts[s.department] || 0) + 1;
}
console.log('Student counts by department:', deptCounts);

fs.writeFileSync('scripts/processed_students.json', JSON.stringify(students, null, 2), 'utf8');
console.log('Saved processed_students.json');
