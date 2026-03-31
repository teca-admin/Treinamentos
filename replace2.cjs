const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const initialContent = content;

  // 1. Remove font-bold, font-black, uppercase globally
  content = content.replace(/\bfont-bold\b /g, 'font-medium ');
  content = content.replace(/\bfont-black\b /g, 'font-medium ');
  content = content.replace(/ font-bold"/g, ' font-medium"');
  content = content.replace(/ font-black"/g, ' font-medium"');
  
  content = content.replace(/\buppercase\b /g, '');
  content = content.replace(/ uppercase"/g, '"');

  // 2. Rename NEXUS to WFS Treinamentos
  content = content.replace(/NEXUS PORTAL/g, 'WFS Treinamentos');
  content = content.replace(/'NEXUS'/g, "'WFS Treinamentos'");
  content = content.replace(/NEXUS/g, 'WFS Treinamentos');

  // 3. Fix EmployeePortal login API route
  if (filePath.includes('EmployeePortal.tsx')) {
    content = content.replace(
      /fetch\("(?:\/api\/search\?q=)" \+ matricula\)/g,
      'fetch("/api/funcionarios/matricula/" + matricula)'
    );
     // Note: the original line is: const res = await fetch("/api/search?q=" + matricula);
    // Let's capture it more safely
    content = content.replace(
      /fetch\("\/api\/search\?q="\s*\+\s*matricula\)/g,
      'fetch("/api/funcionarios/matricula/" + matricula)'
    );

    // After fetch /api/funcionarios/matricula, the data returned is { success: true, funcionario: {...} }
    // The previous /api/search returned an array data[0]
    // Let's fix that too
    content = content.replace(
      /if \(data\.length > 0\) {[\s\S]*?const emp = data\[0\];/g,
      `if (data.success && data.funcionario) {
        const emp = data.funcionario;`
    );
  }

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
