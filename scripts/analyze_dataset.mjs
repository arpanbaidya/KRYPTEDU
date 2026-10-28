import fs from 'node:fs';
import Papa from 'papaparse';

async function analyze() {
  const html = fs.readFileSync('sheet_edit.html', 'utf8');
  
  // Look for sheets/tabs metadata in the html
  const sheetTabMatches = html.match(/"name":"([^"]+)"[^{}]*?"sheetId":(\d+)/g) || [];
  console.log('Sheet tab matches count:', sheetTabMatches.length);
  for (const m of sheetTabMatches) {
    console.log('Tab:', m);
  }

  // Also search for gid= in HTML
  const gids = new Set();
  for (const m of html.matchAll(/#gid=(\d+)/g)) {
    gids.add(m[1]);
  }
  for (const m of html.matchAll(/gid[\\":=]+(\d+)/g)) {
    gids.add(m[1]);
  }
  console.log('Found GIDs:', Array.from(gids));

  // Try exporting any other GIDs if found
  for (const gid of gids) {
    if (gid === '0') continue;
    try {
      const res = await fetch(`https://docs.google.com/spreadsheets/d/1rPyoy2ORmsyf703dsrrZ7ftirjlPonNwW_I1wZb_0yM/export?format=csv&gid=${gid}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`GID ${gid} exported! Size: ${text.length}, First line: ${text.split('\n')[0]}`);
      }
    } catch (e) {
      console.log(`GID ${gid} failed: ${e.message}`);
    }
  }

  // Now analyze official_dataset.csv
  const csvContent = fs.readFileSync('official_dataset.csv', 'utf8');
  const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
  console.log('Parsed rows:', parsed.data.length);
  console.log('Fields:', parsed.meta.fields);

  // Departments, Programmes, Batch Years, etc.
  const deptSet = new Set();
  const progSet = new Set();
  const yearSet = new Set();
  const genderSet = new Set();
  const quotaSet = new Set();
  const sectionSet = new Set();

  for (const row of parsed.data) {
    deptSet.add(row['Department']);
    progSet.add(row['Programme']);
    yearSet.add(row['Batch Year']);
    genderSet.add(row['Gender']);
    quotaSet.add(row['Quota']);
    sectionSet.add(row['Programme Section']);
  }

  console.log('\n--- Unique Departments ---');
  console.log(Array.from(deptSet));
  console.log('\n--- Unique Programmes ---');
  console.log(Array.from(progSet));
  console.log('\n--- Unique Batch Years ---');
  console.log(Array.from(yearSet));
  console.log('\n--- Unique Genders ---');
  console.log(Array.from(genderSet));
  console.log('\n--- Unique Quotas ---');
  console.log(Array.from(quotaSet));
  console.log('\n--- Unique Programme Sections ---');
  console.log(Array.from(sectionSet));

  // Count by Programme
  const countByProg = {};
  for (const row of parsed.data) {
    const p = row['Programme'] || 'Unknown';
    countByProg[p] = (countByProg[p] || 0) + 1;
  }
  console.log('\n--- Count by Programme ---', countByProg);

  // Count by Department column (note: in row 1, Department says "Universal College of Engineering", let's see what Department column contains!)
  const countByDeptCol = {};
  for (const row of parsed.data) {
    const d = row['Department'] || 'Unknown';
    countByDeptCol[d] = (countByDeptCol[d] || 0) + 1;
  }
  console.log('\n--- Count by Department Column ---', countByDeptCol);
}

analyze().catch(console.error);
