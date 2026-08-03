package com.misticraft.admin.ui.screens.artisans

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.misticraft.admin.data.models.Artisan
import com.misticraft.admin.data.repository.ArtisansRepository
import com.misticraft.admin.data.repository.StorageRepository
import com.misticraft.admin.util.slugify
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class ArtisanEditUiState(
    val id: String = "",
    val name: String = "",
    val role: String = "",
    val quote: String = "",
    val tags: String = "",
    val img: String = "",
    val loading: Boolean = false,
    val uploading: Boolean = false,
    val error: String? = null,
    val saved: Boolean = false
)

class ArtisanEditViewModel(
    private val artisansRepository: ArtisansRepository = ArtisansRepository(),
    private val storageRepository: StorageRepository = StorageRepository()
) : ViewModel() {
    private val _uiState = MutableStateFlow(ArtisanEditUiState())
    val uiState: StateFlow<ArtisanEditUiState> = _uiState

    fun load(artisanId: String?) {
        if (artisanId == null) return
        viewModelScope.launch {
            val artisan = artisansRepository.fetchAll().firstOrNull { it.id == artisanId } ?: return@launch
            _uiState.value = ArtisanEditUiState(
                id = artisan.id,
                name = artisan.name,
                role = artisan.role ?: "",
                quote = artisan.quote ?: "",
                tags = artisan.tags.joinToString(", "),
                img = artisan.img ?: ""
            )
        }
    }

    fun update(transform: (ArtisanEditUiState) -> ArtisanEditUiState) {
        _uiState.value = transform(_uiState.value)
    }

    fun uploadImage(bytes: ByteArray, fileName: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(uploading = true, error = null)
            try {
                val url = storageRepository.uploadImage("artisan-images", "", bytes, fileName)
                _uiState.value = _uiState.value.copy(uploading = false, img = url)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(uploading = false, error = e.message ?: "Upload failed.")
            }
        }
    }

    fun save() {
        val s = _uiState.value
        if (s.name.isBlank()) {
            _uiState.value = s.copy(error = "Enter the artisan's name.")
            return
        }
        viewModelScope.launch {
            _uiState.value = s.copy(loading = true, error = null)
            try {
                val artisan = Artisan(
                    id = s.id.ifBlank { slugify(s.name) },
                    name = s.name.trim(),
                    role = s.role.trim().ifBlank { null },
                    quote = s.quote.trim().ifBlank { null },
                    tags = s.tags.split(",").map { it.trim() }.filter { it.isNotBlank() },
                    img = s.img.ifBlank { null }
                )
                artisansRepository.upsert(artisan)
                _uiState.value = _uiState.value.copy(loading = false, saved = true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(loading = false, error = e.message ?: "Could not save.")
            }
        }
    }
}
