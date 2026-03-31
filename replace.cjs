const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const initialContent = content;

  content = content.replace(/nexus-primary/g, 'wfs-accent');
  content = content.replace(/nexus-sidebar/g, 'wfs-text');
  content = content.replace(/nexus-bg/g, 'wfs-bg');
  
  // also change styling rounding from rounded-xl to rounded-sm, and rounded-lg to rounded-sm for a more corporate look as requested
  content = content.replace(/rounded-xl/g, 'rounded-sm');
  content = content.replace(/rounded-lg/g, 'rounded-sm');
  content = content.replace(/rounded-2xl/g, 'rounded-md');

  // specific WFS table requirements: 'bg-wfs-surface2 text-wfs-hint font-mono text-[10px] uppercase'
  // Let's replace some known table styles
  content = content.replace(/bg-slate-50\/80/g, 'bg-wfs-surface2');
  content = content.replace(/text-slate-500 tracking-wider/g, 'text-wfs-muted tracking-wider');

  if (content !== initialContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      replaceInFile(fullPath);
    }
  }
}

processDirectory(directoryPath);
