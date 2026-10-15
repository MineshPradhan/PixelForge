const fs = require('fs');

const content = fs.readFileSync('index.html', 'utf8');

// Find all elements with display: flex in inline style or class
const regex = /<div[^>]*id="modal-([^"]+)"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
let m;
while ((m = regex.exec(content)) !== null) {
  const id = 'modal-' + m[1];
  const body = m[2];
  // check for canvas or side-by-side divs inside
  if (body.includes('<canvas')) {
    console.log(`Modal with canvas: ${id}`);
  }
}
