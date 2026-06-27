const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const version = process.argv[2];

if (!version) {
    console.error('Please provide a version number.');
    process.exit(1);
}

const packages = [
    'package.json',
    'packages/core/package.json',
    'packages/mongoose/package.json',
    'packages/prisma/package.json',
    'packages/typeorm/package.json',
    'packages/cli/package.json',
    'packages/decorators/package.json',
];

console.log(`Updating versions to ${version}...`);

packages.forEach((pkgPath) => {
    const fullPath = path.resolve(__dirname, '..', pkgPath);
    const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    pkg.version = version;

    // Update internal dependencies
    if (pkg.dependencies && pkg.dependencies['@nest-extended/core']) {
        pkg.dependencies['@nest-extended/core'] = version;
    }
    if (pkg.dependencies && pkg.dependencies['@nest-extended/mongoose']) {
        pkg.dependencies['@nest-extended/mongoose'] = version;
    }
    if (pkg.dependencies && pkg.dependencies['@nest-extended/decorators']) {
        pkg.dependencies['@nest-extended/decorators'] = version;
    }
    if (pkg.dependencies && pkg.dependencies['@nest-extended/prisma']) {
        pkg.dependencies['@nest-extended/prisma'] = version;
    }


    fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`Updated ${pkgPath}`);
});

try {
    console.log('Committing changes...');
    execSync('git add .');
    execSync(`git commit -m "chore: release v${version}"`);

    console.log(`Creating tag v${version}...`);
    execSync(`git tag v${version}`);

    console.log('Done! Run "git push && git push --tags" to publish.');
} catch (e) {
    console.error('Failed to commit or tag:', e.message);
    process.exit(1);
}
