import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const isWindows = process.platform === 'win32';

const checks = [];

function commandExists(command, args = ['--version']) {
  try {
    execFileSync(command, args, { stdio: 'ignore', shell: isWindows });
    return true;
  } catch {
    return false;
  }
}

function add(name, ok, detail, required = true) {
  checks.push({ name, ok, detail, required });
}

const javaOk = commandExists('java', ['-version']);
const javacOk = commandExists('javac', ['-version']);
const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
const defaultAndroidSdk = join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const androidSdkOk = Boolean(androidHome && existsSync(androidHome)) || existsSync(defaultAndroidSdk);

add('Capacitor config', existsSync(join(root, 'capacitor.config.ts')), 'capacitor.config.ts');
add('Android project', existsSync(join(root, 'android', 'app', 'build.gradle')), 'android/app/build.gradle');
add('iOS project', existsSync(join(root, 'ios', 'App', 'App', 'Info.plist')), 'ios/App/App/Info.plist');
add('Web build output', existsSync(join(root, 'dist', 'index.html')), 'run npm run build first if missing');
add('Java runtime', javaOk, 'required for Android Gradle builds');
add('Java compiler', javacOk, 'install JDK 17+ and set JAVA_HOME');
add('Android SDK', androidSdkOk, androidHome || defaultAndroidSdk || 'install Android Studio / SDK');

const xcodeOk = process.platform === 'darwin' && commandExists('xcodebuild', ['-version']);
add('Xcode', xcodeOk, 'required only for local iOS builds on macOS', false);

const maxName = Math.max(...checks.map((check) => check.name.length));
for (const check of checks) {
  const mark = check.ok ? 'OK ' : (check.required ? 'NO ' : 'SKIP');
  console.log(`${mark} ${check.name.padEnd(maxName)}  ${check.detail}`);
}

const failedRequired = checks.filter((check) => check.required && !check.ok);
if (failedRequired.length > 0) {
  console.error('\nMobile preflight failed. Install the missing required tools above, then run npm run mobile:sync and retry.');
  process.exit(1);
}

console.log('\nMobile preflight passed for Android. iOS still requires macOS + Xcode or a cloud builder such as Median.');
