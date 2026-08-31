import fs from 'fs';

const path = 'C:\\Users\\Patriarch Romana\\.gemini\\antigravity\\brain\\e1e31ca1-53a9-4b8c-b374-6e63e0468c01\\.system_generated\\steps\\988\\content.md';
const content = fs.readFileSync(path, 'utf-8');

// Find all script tags
const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
const texts = [];

while ((match = scriptRegex.exec(content)) !== null) {
  const scriptContent = match[1];
  if (scriptContent.includes('Modelos de áudio') || scriptContent.includes('parts') || scriptContent.includes('author') || scriptContent.includes('message')) {
    texts.push(scriptContent);
    count++;
  }
}

console.log(`Found ${count} matching scripts.`);
if (texts.length > 0) {
  fs.writeFileSync('C:\\Users\\Patriarch Romana\\.gemini\\antigravity\\brain\\e1e31ca1-53a9-4b8c-b374-6e63e0468c01\\scratch\\chatgpt_scripts.txt', texts[0], 'utf-8');
}
