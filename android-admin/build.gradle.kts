// Top-level build file — plugin versions declared here, applied per-module.
//
// AGP/Kotlin versions here were bumped from an initial guess after CI
// (see .github/workflows/android-build.yml) reported the original pins
// (AGP 8.5.2, Kotlin 1.9.24, compileSdk 34) were too old for some
// transitively-resolved dependencies (androidx.browser 1.10.0,
// Compose UI 1.9.0, etc. — see the "AAR metadata" error in that run's
// log). AGP 8.9.1 and compileSdk 36 are the exact minimums that build
// output named as sufficient; Kotlin 2.0.21 + the Compose Compiler
// Gradle plugin replace the old kotlinCompilerExtensionVersion
// mechanism, which doesn't support Compose UI 1.9.x. If a future CI
// run reports a still-newer minimum, bump these the same way.
plugins {
    id("com.android.application") version "8.9.1" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.0.21" apply false
}
