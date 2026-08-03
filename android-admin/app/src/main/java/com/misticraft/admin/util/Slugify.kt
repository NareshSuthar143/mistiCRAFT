package com.misticraft.admin.util

import java.util.UUID

/** Mirrors slugify() in misticraft-data.js, used for new product/artisan/founder ids. */
fun slugify(input: String): String {
    val slug = input.lowercase().trim()
        .replace(Regex("[^a-z0-9]+"), "-")
        .trim('-')
    return slug.ifBlank { "item-" + UUID.randomUUID().toString().take(6) }
}
