package com.misticraft.admin.data.models

import kotlinx.serialization.Serializable

@Serializable
data class Product(
    val id: String = "",
    val name: String = "",
    val category: String? = null,
    val technique: String? = null,
    val tagline: String? = null,
    val price: Double = 0.0,
    val mrp: Double = 0.0,
    val stock: Int = 0,
    val status: String = "active",
    val featured: Boolean = false,
    val img: String? = null
)
