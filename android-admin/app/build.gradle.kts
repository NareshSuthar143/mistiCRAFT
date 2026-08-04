plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.misticraft.admin"
    // Bumped from 34 -> 36: CI reported androidx.browser:browser:1.10.0
    // and Compose UI 1.9.0 (both pulled in transitively) require
    // compiling against API 36. See build.gradle.kts (root) for the
    // matching AGP/Kotlin bump this required.
    compileSdk = 36

    defaultConfig {
        applicationId = "com.misticraft.admin"
        // NotificationListenerService + notification channels need API 26+.
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }
    // No composeOptions.kotlinCompilerExtensionVersion here — the
    // org.jetbrains.kotlin.plugin.compose plugin (applied above) picks
    // a compatible compiler automatically from the Kotlin version. The
    // old manual-version mechanism doesn't support Compose UI 1.9.x.

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

// Kotlin Gradle plugin 2.x hard-errors on the old
// android { kotlinOptions { jvmTarget = "17" } } syntax ("migrate to
// the compilerOptions DSL") — this is the replacement, as a top-level
// block sibling to android { }, not nested inside it.
kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.06.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.3")
    implementation("androidx.activity:activity-compose:1.9.0")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.7.7")

    // -- Supabase (Postgrest/Auth/Realtime/Storage) --
    // Verified against Maven Central's actual published versions (see
    // repo.maven.apache.org/maven2/io/github/jan-tennert/supabase/) —
    // auth-kt only exists from 3.0.0 onward (it was gotrue-kt before
    // that), so this must stay on the 3.x line. Re-check that URL if a
    // future bump is needed.
    // https://github.com/supabase-community/supabase-kt
    val supabaseVersion = "3.7.0"
    implementation("io.github.jan-tennert.supabase:postgrest-kt:$supabaseVersion")
    implementation("io.github.jan-tennert.supabase:auth-kt:$supabaseVersion")
    implementation("io.github.jan-tennert.supabase:realtime-kt:$supabaseVersion")
    implementation("io.github.jan-tennert.supabase:storage-kt:$supabaseVersion")
    implementation("io.ktor:ktor-client-okhttp:2.3.12")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // Image loading for product/artisan/founder photos.
    implementation("io.coil-kt:coil-compose:2.6.0")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
