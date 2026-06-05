const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const cwd = process.cwd();

const raw = execSync(
  'grep -rn "require(.*\\\\.js" src/ --include="*.ts" --include="*.tsx"',
  {encoding: 'utf8', cwd}
).trim().split('\n').filter(Boolean);

const fileChanges = {};

for (const line of raw) {
  const idx1 = line.indexOf(':');
  const idx2 = line.indexOf(':', idx1+1);
  if (idx1 < 0 || idx2 < 0) continue;
  const file = line.slice(0, idx1);
  const content = line.slice(idx2+1);

  const reqMatches = [...content.matchAll(/require\(\s*['"]([^'"]+\.js)['"]\s*\)/g)];
  for (const rm of reqMatches) {
    const reqPath = rm[1];
    if (!reqPath.startsWith('.') && !reqPath.startsWith('src/')) continue;

    const fileDir = path.dirname(path.resolve(cwd, file));
    let absBase;
    if (reqPath.startsWith('src/')) {
      absBase = path.resolve(cwd, reqPath.replace(/\.js$/, ''));
    } else {
      absBase = path.resolve(fileDir, reqPath.replace(/\.js$/, ''));
    }

    const jsExists = fs.existsSync(absBase + '.js');
    const tsExists = fs.existsSync(absBase + '.ts');
    const tsxExists = fs.existsSync(absBase + '.tsx');

    if (!jsExists && (tsExists || tsxExists)) {
      const newExt = tsxExists ? '.tsx' : '.ts';
      const oldStr = reqPath;
      const newStr = reqPath.replace(/\.js$/, newExt);
      if (!fileChanges[file]) fileChanges[file] = [];
      if (!fileChanges[file].find(x => x.old === oldStr)) {
        fileChanges[file].push({old: oldStr, new: newStr});
      }
    }
  }
}

let totalChanges = 0;
for (const [file, changes] of Object.entries(fileChanges)) {
  const fullPath = path.resolve(cwd, file);
  let content = fs.readFileSync(fullPath, 'utf8');

  for (const c of changes) {
    const escapedOld = c.old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      'require\\(\\s*[\'"]' + escapedOld + '[\'"]\\s*\\)',
      'g'
    );
    const replacement = "require('" + c.new + "')";
    const before = content;
    content = content.replace(regex, replacement);
    if (content !== before) totalChanges++;
  }

  fs.writeFileSync(fullPath, content, 'utf8');
}

console.log('Applied ' + totalChanges + ' replacements across ' + Object.keys(fileChanges).length + ' files');
