package com.misticraft.admin.data.models

import kotlinx.serialization.Serializable

@Serializable
data class Artisan(
    val id: String = "",
    val name: String = "",
    val role: String? = null,
    val quote: String? = null,
    val tags: List<String> = emptyList(),
    val img: String? = null
)
