package com.misticraft.admin.ui.screens.founders

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.misticraft.admin.data.models.Founder
import com.misticraft.admin.data.repository.FoundersRepository
import com.misticraft.admin.data.repository.StorageRepository
import com.misticraft.admin.util.slugify
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class FounderEditUiState(
    val id: String = "",
    val name: String = "",
    val role: String = "",
    val quote: String = "",
    val img: String = "",
    val loading: Boolean = false,
    val uploading: Boolean = false,
    val error: String? = null,
    val saved: Boolean = false
)

class FounderEditViewModel(
    private val foundersRepository: FoundersRepository = FoundersRepository(),
    private val storageRepository: StorageRepository = StorageRepository()
) : ViewModel() {
    private val _uiState = MutableStateFlow(FounderEditUiState())
    val uiState: StateFlow<FounderEditUiState> = _uiState

    fun load(founderId: String?) {
        if (founderId == null) return
        viewModelScope.launch {
            val founder = foundersRepository.fetchAll().firstOrNull { it.id == founderId } ?: return@launch
            _uiState.value = FounderEditUiState(
                id = founder.id,
                name = founder.name,
                role = founder.role ?: "",
                quote = founder.quote ?: "",
                img = founder.img ?: ""
            )
        }
    }

    fun update(transform: (FounderEditUiState) -> FounderEditUiState) {
        _uiState.value = transform(_uiState.value)
    }

    fun uploadImage(bytes: ByteArray, fileName: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(uploading = true, error = null)
            try {
                val url = storageRepository.uploadImage("founder-images", "", bytes, fileName)
                _uiState.value = _uiState.value.copy(uploading = false, img = url)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(uploading = false, error = e.message ?: "Upload failed.")
            }
        }
    }

    fun save() {
        val s = _uiState.value
        if (s.name.isBlank()) {
            _uiState.value = s.copy(error = "Enter the leader's name.")
            return
        }
        viewModelScope.launch {
            _uiState.value = s.copy(loading = true, error = null)
            try {
                val founder = Founder(
                    id = s.id.ifBlank { slugify(s.name) },
                    name = s.name.trim(),
                    role = s.role.trim().ifBlank { null },
                    quote = s.quote.trim().ifBlank { null },
                    img = s.img.ifBlank { null }
                )
                foundersRepository.upsert(founder)
                _uiState.value = _uiState.value.copy(loading = false, saved = true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(loading = false, error = e.message ?: "Could not save.")
            }
        }
    }
}
