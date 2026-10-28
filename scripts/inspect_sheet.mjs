import fs from 'node:fs';

async function main() {
  const sheetId = '1rPyoy2ORmsyf703dsrrZ7ftirjlPonNwW_I1wZb_0yM';
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  
  console.log('Downloading CSV from:', exportUrl);
  const res = await fetch(exportUrl);
  if (!res.ok) {
    console.error('Failed to download CSV:', res.status, res.statusText);
    return;
  }
  const csvText = await res.text();
  fs.writeFileSync('official_dataset.csv', csvText, 'utf8');
  console.log('Saved official_dataset.csv, size:', csvText.length, 'bytes');

  // Let's also check the edit page to see if there are other sheets/tabs
  const editRes = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
  const html = await editRes.text();
  fs.writeFileSync('sheet_edit.html', html, 'utf8');

  // Look for sheet tabs in html
  // Usually in var bootstrapData = ...
  const lines = csvText.split('\n');
  console.log('Header line:', lines[0]);
  console.log('Total lines:', lines.length);
  for (let i = 1; i <= Math.min(5, lines.length - 1); i++) {
    console.log(`Row ${i}:`, lines[i]);
  }
}

main().catch(console.error);
