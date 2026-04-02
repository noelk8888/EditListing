const fs = require('fs');

const files = [
  'app/api/add-listing/route.ts',
  'app/api/update/route.ts'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Revert getPHLTimestamp() back to new Date().toISOString()
  content = content.replace(/getPHLTimestamp\(\)/g, "new Date().toISOString()");
  content = content.replace(/getPHLDate, getPHLTimestamp/g, "getPHLDate");

  fs.writeFileSync(file, content, 'utf8');
}
