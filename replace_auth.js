const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? 
            walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const targetDir = 'e:/phbs26/app/src';

walkDir(targetDir, function(filePath) {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        let content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes('supabase.auth.getUser()')) {
            // Replace the standard one
            let newContent = content.replace(
                /const { data: { user } } = await supabase\.auth\.getUser\(\)/g,
                'const { data: { session } } = await supabase.auth.getSession()\n  const user = session?.user'
            );
            // Replace user.ts one
            newContent = newContent.replace(
                /const { data: { user }, error: authError } = await supabaseClient\.auth\.getUser\(\)/g,
                'const { data: { session }, error: authError } = await supabaseClient.auth.getSession()\n    const user = session?.user'
            );
            
            if (newContent !== content) {
                fs.writeFileSync(filePath, newContent, 'utf-8');
                console.log(`Updated: ${filePath}`);
            }
        }
    }
});
