import fs from 'fs';

const path = 'C:\\Users\\Patriarch Romana\\.gemini\\antigravity\\brain\\e1e31ca1-53a9-4b8c-b374-6e63e0468c01\\scratch\\chatgpt_scripts.txt';
const text = fs.readFileSync(path, 'utf-8');

console.log('Script Length:', text.length);
console.log('Sample:', text.substring(0, 500));

// Find where "Modelos de áudio" or Portuguese words appear
const idx = text.indexOf('Modelos de áudio');
if (idx !== -1) {
  console.log('Around "Modelos de áudio":\n', text.substring(Math.max(0, idx - 100), Math.min(text.length, idx + 2000)));
}
