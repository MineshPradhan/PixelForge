const fs = require('fs');

const content = fs.readFileSync('index.html', 'utf8');
const voidTags = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 
  'meta', 'param', 'source', 'track', 'wbr',
  // SVG self-closing common tags
  'path', 'circle', 'line', 'polyline', 'polygon', 'rect', 'ellipse', 'stop', 'use'
]);

const regex = /<(\/)?([a-zA-Z0-9\-]+)([^>]*)>/g;
let match;
const stack = [];

while ((match = regex.exec(content)) !== null) {
  const isClosing = !!match[1];
  const tag = match[2].toLowerCase();
  const rawTag = match[0];
  const attrStr = match[3];

  if (voidTags.has(tag) || rawTag.endsWith('/>')) {
    continue;
  }

  const upTo = content.substring(0, match.index);
  const line = upTo.split('\n').length;
  const idMatch = attrStr.match(/id=["']([^"']+)["']/);
  const id = idMatch ? idMatch[1] : '';

  if (isClosing) {
    if (stack.length === 0) {
      console.log(`Extra closing </${tag}> at line ${line}`);
    } else {
      const top = stack[stack.length - 1];
      if (top.tag === tag) {
        stack.pop();
      } else {
        // Search back in stack
        const foundIdx = stack.map(s => s.tag).lastIndexOf(tag);
        if (foundIdx !== -1) {
          console.log(`Mismatch at line ${line}: closing </${tag}> closes <${tag}#${stack[foundIdx].id}> from line ${stack[foundIdx].line}, but tags in between were not closed:`, stack.slice(foundIdx + 1).map(s => `<${s.tag}#${s.id}> (${s.line})`));
          stack.splice(foundIdx);
        } else {
          console.log(`Unexpected closing </${tag}> at line ${line}`);
        }
      }
    }
  } else {
    stack.push({ tag, line, id });
  }
}

if (stack.length > 0) {
  console.log('Unclosed tags remaining:');
  stack.forEach(s => console.log(`  <${s.tag}${s.id ? '#' + s.id : ''}> from line ${s.line}`));
} else {
  console.log('All tags matched perfectly!');
}
