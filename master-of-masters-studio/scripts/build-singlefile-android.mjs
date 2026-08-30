import fs from 'fs';
import path from 'path';

// Read the built dist files
const distDir = path.resolve('dist');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('❌ dist/index.html not found! Run bun run build first.');
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf-8');

// Find and inline CSS files
const cssRegex = /<link rel="stylesheet" crossorigin href="(\.\/assets\/[^"]+\.css)">/g;
let match;
while ((match = cssRegex.exec(html)) !== null) {
  const fullTag = match[0];
  const cssHref = match[1].replace('./assets/', '');
  const cssFile = path.join(distDir, 'assets', cssHref);
  if (fs.existsSync(cssFile)) {
    const cssContent = fs.readFileSync(cssFile, 'utf-8');
    const idx = html.indexOf(fullTag);
    if (idx !== -1) {
      html = html.substring(0, idx) + `<style>\n${cssContent}\n</style>` + html.substring(idx + fullTag.length);
    }
  }
}

// Find and inline JS files
const jsRegex = /<script type="module" crossorigin src="(\.\/assets\/[^"]+\.js)"><\/script>/g;
while ((match = jsRegex.exec(html)) !== null) {
  const fullTag = match[0];
  const jsSrc = match[1].replace('./assets/', '');
  const jsFile = path.join(distDir, 'assets', jsSrc);
  if (fs.existsSync(jsFile)) {
    const jsContent = fs.readFileSync(jsFile, 'utf-8');
    const safeJs = jsContent.replace(/<\/script>/g, '<\\/script>');
    const idx = html.indexOf(fullTag);
    if (idx !== -1) {
      html = html.substring(0, idx) + `<script type="module">\n${safeJs}\n</script>` + html.substring(idx + fullTag.length);
    }
  }
}

// Save as the Single-File Portable Android App
const outputDist = path.join(distDir, 'MasterOfMasters-StudioPro-Android.html');
const outputRoot = path.resolve('MasterOfMasters-StudioPro-Android.html');

fs.writeFileSync(outputDist, html, 'utf-8');
fs.writeFileSync(outputRoot, html, 'utf-8');

const sizeKb = (fs.statSync(outputRoot).size / 1024).toFixed(1);
console.log(`✅ Single-File Android App generated successfully!`);
console.log(`📦 File created: MasterOfMasters-StudioPro-Android.html (${sizeKb} KB)`);
console.log(`📲 Pronto para enviar por WhatsApp e abrir direto no Oppo Find Ultra, Samsung S24 Ultra ou qualquer celular!`);
