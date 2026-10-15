const fs = require('fs');

const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

const modals = [];
lines.forEach((l, i) => {
  const match = l.match(/<div class="[^"]*modal-backdrop[^"]*" id="([^"]+)"/);
  if (match) {
    modals.push({ id: match[1], line: i + 1 });
  }
});

console.log(`Found ${modals.length} modals:`);
modals.forEach(m => console.log(`  Line ${m.line}: ${m.id}`));
