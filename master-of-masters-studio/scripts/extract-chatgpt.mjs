import fs from 'fs';

const path = 'C:\\Users\\Patriarch Romana\\.gemini\\antigravity\\brain\\e1e31ca1-53a9-4b8c-b374-6e63e0468c01\\.system_generated\\steps\\988\\content.md';
const content = fs.readFileSync(path, 'utf-8');

// Regex to find message text or serverState/props
const textMatches = [];
const regex = /"text":\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
let m;
while ((m = regex.exec(content)) !== null) {
  try {
    const unescaped = JSON.parse(`"${m[1]}"`);
    if (unescaped.length > 30) {
      textMatches.push(unescaped);
    }
  } catch (e) {}
}

const outPath = 'C:\\Users\\Patriarch Romana\\.gemini\\antigravity\\brain\\e1e31ca1-53a9-4b8c-b374-6e63e0468c01\\scratch\\chatgpt_extracted.txt';
fs.writeFileSync(outPath, textMatches.join('\n\n---\n\n'), 'utf-8');
console.log(`Extracted ${textMatches.length} messages. Saved to scratch/chatgpt_extracted.txt`);
