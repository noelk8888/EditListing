const { google } = require('googleapis');
const fs = require('fs');

async function main() {
  const serviceAccountPath = '/Users/noelk/repos/2ND LUXE LISTING/service-account.json';
  const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
  
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });
  
  const response = await drive.files.list({
    pageSize: 50,
    fields: 'files(id, name, mimeType)',
  });
  
  console.log('Files found:');
  response.data.files.forEach(f => {
    console.log(`- Name: "${f.name}", ID: "${f.id}", Mime: "${f.mimeType}"`);
  });
}

main().catch(console.error);
