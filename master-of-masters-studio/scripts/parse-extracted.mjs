import fs from 'fs';

const path = 'C:\\Users\\Patriarch Romana\\.gemini\\antigravity\\brain\\e1e31ca1-53a9-4b8c-b374-6e63e0468c01\\scratch\\chatgpt_scripts.txt';
const text = fs.readFileSync(path, 'utf-8');

// Find all strings in __remixContext or React state
const out = [];
// Find any JSON object containing "parts"
const partsRegex = /"parts":\s*(\[[^\]]*\])/g;
let m;
while ((m = partsRegex.exec(text)) !== null) {
  try {
    const parts = JSON.parse(m[1]);
    out.push(parts.join('\n'));
  } catch (e) {
    out.push(m[1]);
  }
}

// Also search for prompt/response text
const promptRegex = /"title":"([^"]+)"/g;
while ((m = promptRegex.exec(text)) !== null) {
  out.push(`TITLE: ${m[1]}`);
}

const outFile = 'C:\\Users\\Patriarch Romana\\.gemini\\antigravity\\brain\\e1e31ca1-53a9-4b8c-b374-6e63e0468c01\\scratch\\extracted_conversation.txt';
fs.writeFileSync(outFile, out.join('\n\n========================================\n\n'), 'utf-8');
console.log(`Saved ${out.length} items to scratch/extracted_conversation.txt`);
