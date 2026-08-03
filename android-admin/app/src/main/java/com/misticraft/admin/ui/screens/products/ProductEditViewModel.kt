package com.misticraft.admin.ui.screens.products

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.misticraft.admin.data.models.Product
import com.misticraft.admin.data.repository.ProductsRepository
import com.misticraft.admin.data.repository.StorageRepository
import com.misticraft.admin.util.slugify
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class ProductEditUiState(
    val id: String = "",
    val name: String = "",
    val category: String = "",
    val technique: String = "",
    val tagline: String = "",
    val price: String = "",
    val mrp: String = "",
    val stock: String = "",
    val status: String = "active",
    val featured: Boolean = false,
    val img: String = "",
    val loading: Boolean = false,
    val uploading: Boolean = false,
    val error: String? = null,
    val saved: Boolean = false
)

class ProductEditViewModel(
    private val productsRepository: ProductsRepository = ProductsRepository(),
    private val storageRepository: StorageRepository = StorageRepository()
) : ViewModel() {
    private val _uiState = MutableStateFlow(ProductEditUiState())
    val uiState: StateFlow<ProductEditUiState> = _uiState

    fun load(productId: String?) {
        if (productId == null) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true)
            val product = productsRepository.fetchAll().firstOrNull { it.id == productId }
            if (product != null) {
                _uiState.value = ProductEditUiState(
                    id = product.id,
                    name = product.name,
                    category = product.category ?: "",
                    technique = product.technique ?: "",
                    tagline = product.tagline ?: "",
                    price = product.price.toString(),
                    mrp = product.mrp.toString(),
                    stock = product.stock.toString(),
                    status = product.status,
                    featured = product.featured,
                    img = product.img ?: ""
                )
            } else {
                _uiState.value = _uiState.value.copy(loading = false, error = "Product not found")
            }
        }
    }

    fun update(transform: (ProductEditUiState) -> ProductEditUiState) {
        _uiState.value = transform(_uiState.value)
    }

    fun uploadImage(bytes: ByteArray, fileName: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(uploading = true, error = null)
            try {
                val url = storageRepository.uploadImage("product-images", "", bytes, fileName)
                _uiState.value = _uiState.value.copy(uploading = false, img = url)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(uploading = false, error = e.message ?: "Upload failed — check your connection.")
            }
        }
    }

    fun save() {
        val s = _uiState.value
        if (s.name.isBlank()) {
            _uiState.value = s.copy(error = "Enter the product name.")
            return
        }
        viewModelScope.launch {
            _uiState.value = s.copy(loading = true, error = null)
            try {
                val product = Product(
                    id = s.id.ifBlank { slugify(s.name) },
                    name = s.name.trim(),
                    category = s.category.trim().ifBlank { null },
                    technique = s.technique.trim().ifBlank { null },
                    tagline = s.tagline.trim().ifBlank { null },
                    price = s.price.toDoubleOrNull() ?: 0.0,
                    mrp = s.mrp.toDoubleOrNull() ?: 0.0,
                    stock = s.stock.toIntOrNull() ?: 0,
                    status = s.status,
                    featured = s.featured,
                    img = s.img.ifBlank { null }
                )
                productsRepository.upsert(product)
                _uiState.value = _uiState.value.copy(loading = false, saved = true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(loading = false, error = e.message ?: "Could not save — check your connection.")
            }
        }
    }
}
