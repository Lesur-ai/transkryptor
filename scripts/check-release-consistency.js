// Vérifie que toutes les références de version sont alignées sur le fichier VERSION.
// Sans dépendance npm : exécutable avant `npm ci`, en local comme dans Docker.
// Garde-fou ajouté après la dérive du REF de scripts/install.sh, resté sur
// v6.1.1 pendant les releases v6.1.2 et v6.2.0.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const failures = [];

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

function expectEqual(label, actual, expected) {
    if (actual !== expected) {
        failures.push(`${label}: expected "${expected}", found "${actual}"`);
    }
}

function expectMatch(relativePath, pattern, expected) {
    const match = read(relativePath).match(pattern);
    expectEqual(relativePath, match ? match[1] : '(pattern not found)', expected);
}

function expectInstallUrls(relativePath, expected) {
    const refs = [...read(relativePath).matchAll(/Lesur-ai\/transkryptor\/([^/\s]+)\/scripts\/install\.sh/g)]
        .map(match => match[1]);
    if (refs.length === 0) {
        failures.push(`${relativePath}: no installer URL found`);
    }
    refs.forEach(ref => expectEqual(`${relativePath} (installer URL)`, ref, expected));
}

const version = read('VERSION').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(`Invalid VERSION: "${version}"`);
    process.exit(1);
}
const tag = `v${version}`;

const packageJson = JSON.parse(read('package.json'));
expectEqual('package.json', packageJson.version, version);

const packageLock = JSON.parse(read('package-lock.json'));
expectEqual('package-lock.json (root)', packageLock.version, version);
expectEqual('package-lock.json (packages[""])', packageLock.packages?.['']?.version, version);

expectMatch('src/server/server.js', /let APP_VERSION = '([^']+)'/, version);
expectMatch('src/client/js/state.js', /appVersion: '([^']+)'/, version);
expectMatch('src/client/js/apiService.js', /return '(\d+\.\d+\.\d+)'/, version);
expectMatch('src/client/index.html', /id="header-version"[^>]*>([^<]+)</, tag);
// Le script est servi depuis le tag (URL README) mais clone REF : les deux doivent coïncider.
expectMatch('scripts/install.sh', /REF="\$\{TRANSKRYPTOR_REF:-([^}]+)\}"/, tag);

expectInstallUrls('README.md', tag);
expectInstallUrls('README_FR.md', tag);

const releaseNotes = `docs/releases/${tag}.md`;
if (fs.existsSync(path.join(ROOT, releaseNotes))) {
    expectInstallUrls(releaseNotes, tag);
} else {
    failures.push(`${releaseNotes}: missing file`);
}

const changelog = read('changelog.md');
const escapedVersion = version.replace(/\./g, '\\.');
if (!new RegExp(`^## \\[${escapedVersion}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm').test(changelog)) {
    failures.push(`changelog.md: missing "## [${version}] - YYYY-MM-DD" section`);
}
expectMatch('changelog.md', /^\[Unreleased\]: \S+\/compare\/(\S+)\.\.\.HEAD$/m, tag);
if (!new RegExp(`^\\[${escapedVersion}\\]: \\S+$`, 'm').test(changelog)) {
    failures.push(`changelog.md: missing [${version}] comparison link`);
}

if (failures.length > 0) {
    console.error(`Release consistency checks failed (VERSION = ${version}):`);
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(`release consistency checks passed (${tag})`);
