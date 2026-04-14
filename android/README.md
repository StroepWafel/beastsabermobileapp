# BSLink (Android — BeatSaver)

Open this folder in Android Studio, or build from the command line with **Java 17+ full JDK** (not a JRE only). The Android Gradle Plugin needs `jlink` (included in a JDK). If you see `jlink.exe does not exist`, install [Eclipse Temurin JDK 17](https://adoptium.net/) and set `JAVA_HOME` to that JDK, or add to `local.properties`:

```
org.gradle.java.home=C\:\\Program Files\\Eclipse Adoptium\\jdk-17.x.x-hotspot
```

Copy `local.properties.example` to `local.properties` and set `sdk.dir` to your Android SDK (Android Studio usually creates this file for you).
