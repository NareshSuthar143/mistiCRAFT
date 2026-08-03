package com.misticraft.admin.data.repository

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.misticraft.admin.data.SupabaseClientProvider
import io.github.jan.supabase.storage.storage
import java.io.ByteArrayOutputStream

/**
 * Mirrors mistiData.uploadImage() in misticraft-data.js: resize to a
 * max 1600px edge, JPEG-compress, upload with a timestamp-prefixed
 * filename, upsert=true, return the public URL.
 */
class StorageRepository {
    private val client = SupabaseClientProvider.client

    suspend fun uploadImage(bucket: String, subPath: String, originalBytes: ByteArray, originalFileName: String): String {
        val resized = resizeAndCompress(originalBytes, maxEdge = 1600)
        val safeName = System.currentTimeMillis().toString() + "-" +
            originalFileName.replace(Regex("[^a-zA-Z0-9.\\-_]"), "_")
        val path = if (subPath.isNotBlank()) "$subPath/$safeName" else safeName

        client.storage.from(bucket).upload(path, resized) {
            upsert = true
        }
        return client.storage.from(bucket).publicUrl(path)
    }

    private fun resizeAndCompress(bytes: ByteArray, maxEdge: Int): ByteArray {
        val original = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            ?: return bytes
        val largestEdge = maxOf(original.width, original.height)
        val scaled = if (largestEdge > maxEdge) {
            val scale = maxEdge.toFloat() / largestEdge
            Bitmap.createScaledBitmap(
                original,
                (original.width * scale).toInt().coerceAtLeast(1),
                (original.height * scale).toInt().coerceAtLeast(1),
                true
            )
        } else {
            original
        }
        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, 85, out)
        return out.toByteArray()
    }
}
