const fs = require('fs');

const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

const idMap = new Map();
lines.forEach((l, idx) => {
  const matches = [...l.matchAll(/id=["']([^"']+)["']/g)];
  matches.forEach(m => {
    const id = m[1];
    if (!idMap.has(id)) {
      idMap.set(id, []);
    }
    idMap.get(id).push(idx + 1);
  });
});

let dupCount = 0;
idMap.forEach((lineNumbers, id) => {
  if (lineNumbers.length > 1) {
    dupCount++;
    console.log(`Duplicate ID "${id}" on lines: ${lineNumbers.join(', ')}`);
  }
});

console.log(`Total duplicate IDs found: ${dupCount}`);
