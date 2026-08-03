# Add project specific ProGuard rules here.
# Kotlinx Serialization + Supabase models are reflection-light (uses
# compile-time generated serializers), but keep model classes just in case
# you enable R8/minification for a release build.
-keep class com.misticraft.admin.data.models.** { *; }
