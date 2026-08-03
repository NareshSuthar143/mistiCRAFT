package com.misticraft.admin.data.models

import kotlinx.serialization.Serializable

@Serializable
data class StoreSettings(
    val id: Int = 1,
    @kotlinx.serialization.SerialName("shipping_fee") val shippingFee: Double = 99.0,
    @kotlinx.serialization.SerialName("store_email") val storeEmail: String? = null,
    @kotlinx.serialization.SerialName("store_phone") val storePhone: String? = null,
    @kotlinx.serialization.SerialName("default_transporter") val defaultTransporter: String? = null,
    @kotlinx.serialization.SerialName("upi_id") val upiId: String? = null,
    @kotlinx.serialization.SerialName("upi_payee_name") val upiPayeeName: String? = null
)
