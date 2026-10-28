import fs from 'node:fs';
import Papa from 'papaparse';

const csv = fs.readFileSync('official_dataset.csv', 'utf8');
const { data, meta } = Papa.parse(csv, { header: true, skipEmptyLines: true });

console.log('Columns:', meta.fields);
console.log('Row count:', data.length);

const summary = {};
for (const field of meta.fields) {
  const vals = new Set();
  let emptyCount = 0;
  for (const row of data) {
    const val = (row[field] || '').trim();
    if (!val || val === '#REF!') emptyCount++;
    else vals.add(val);
  }
  summary[field] = {
    distinctCount: vals.size,
    emptyOrErrorCount: emptyCount,
    sampleValues: Array.from(vals).slice(0, 5)
  };
}

console.log(JSON.stringify(summary, null, 2));
