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
    console.error('❌ Failed to generate version info:', error);
}
