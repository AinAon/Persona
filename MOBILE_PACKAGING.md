# Mobile Packaging

## General User Link

Use `user.html` for the basic-user entrypoint.

- Local: `file:///D:/Dropbox/AI/_Github/Persona/user.html`
- Hosted: `<site-root>/user.html`

This entrypoint disables temporary admin mode in the browser and opens `index.html?basic=1`.

## Android APK

This project uses Capacitor for the Android shell.

Commands:

```powershell
npm install
npm run mobile:sync
npm run mobile:apk
```

Output after a successful debug build:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Requirements:

- JDK installed and `JAVA_HOME` set.
- Android SDK installed and `ANDROID_HOME` set.

Current local machine status at setup time:

- `npm run mobile:sync` succeeded.
- `npm run mobile:apk` stopped because `JAVA_HOME` and `java` were missing.
