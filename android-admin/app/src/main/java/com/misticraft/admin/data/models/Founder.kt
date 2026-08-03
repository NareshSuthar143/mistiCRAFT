package com.misticraft.admin.data.models

import kotlinx.serialization.Serializable

@Serializable
data class Founder(
    val id: String = "",
    val name: String = "",
    val role: String? = null,
    val quote: String? = null,
    val img: String? = null
)
