plugins {
  id("com.android.application")
}
android {
  namespace = "ke.chemchemtv.mobile"
  compileSdk = 36
  defaultConfig {
    applicationId = "ke.chemchemtv.mobile"
    minSdk = 23
    targetSdk = 36
    versionCode = 10
    versionName = "7.1"
  }
}
dependencies {
  implementation("androidx.core:core-ktx:1.17.0")
  implementation("androidx.appcompat:appcompat:1.7.1")
  implementation("com.google.android.material:material:1.13.0")
  implementation("com.github.pedroSG94.RootEncoder:library:2.7.5")
}