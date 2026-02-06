import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

try {
    // Get latest commit hash
    const commitHash = execSync('git rev-parse --short HEAD').toString().trim();

    // Get latest commit message
    const commitMessage = execSync('git log -1 --pretty=%B').toString().trim();

    // Get timestamp
    const timestamp = new Date().toISOString();

    const versionInfo = {
        version: commitHash,
        message: commitMessage,
        timestamp: timestamp
    };

    const filePath = join(process.cwd(), 'public', 'version.json');
    writeFileSync(filePath, JSON.stringify(versionInfo, null, 2));

    console.log('✅ Generated version.json:', versionInfo);
} catch (error) {
    console.warn('⚠️ Could not retrieve git info (likely non-git environment). Using fallback.');

    // Fallback info
    const versionInfo = {
        version: 'dev-build',
        message: 'No git info available',
        timestamp: new Date().toISOString()
    };

    const filePath = join(process.cwd(), 'public', 'version.json');
    try {
        writeFileSync(filePath, JSON.stringify(versionInfo, null, 2));
        console.log('✅ Generated fallback version.json');
    } catch (e) {
        console.error('❌ Failed to write fallback version.json', e);
    }
}
