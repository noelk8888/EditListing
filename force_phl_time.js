const fs = require('fs');

const files = [
  'app/api/add-listing/route.ts',
  'app/api/update/route.ts',
  'app/(dashboard)/add/page.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Insert imports
  if (!content.includes('getPHLDate')) {
    if (content.includes('import { cn } from "@/lib/utils"')) {
      content = content.replace('import { cn } from "@/lib/utils"', 'import { cn, getPHLDate, getPHLTimestamp } from "@/lib/utils"');
    } else {
      content = 'import { getPHLDate, getPHLTimestamp } from "@/lib/utils";\n' + content;
    }
  }

  // Replace getTodayDate logic in page.tsx
  if (file.includes('page.tsx')) {
    content = content.replace(/const getTodayDate = \(\): string => \{\n  return new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\];\n\};/g, 
        'const getTodayDate = (): string => {\n  return getPHLDate();\n};');
    
    // Replace all new Date().toISOString().split('T')[0]
    content = content.replace(/new Date\(\)\.toISOString\(\)\.split\(['"]T['"]\)\[0\]/g, 'getPHLDate()');

    // Replace new Date().toISOString()
    content = content.replace(/new Date\(\)\.toISOString\(\)/g, 'getPHLTimestamp()');

    // Replace new Date().toLocaleDateString("en-US", { month: "long", ... }) in Telegram
    // It's used as: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    content = content.replace(/new Date\(\)\.toLocaleDateString\("en-US", { month: "long", day: "numeric", year: "numeric" }\)/g, 'new Date(getPHLDate()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })');
  } else {
    // API Routes replacements
    content = content.replace(/new Date\(\)\.toISOString\(\)\.split\(['"]T['"]\)\[0\]/g, 'getPHLDate()');
    content = content.replace(/new Date\(\)\.toISOString\(\)/g, 'getPHLTimestamp()');
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed', file);
}
