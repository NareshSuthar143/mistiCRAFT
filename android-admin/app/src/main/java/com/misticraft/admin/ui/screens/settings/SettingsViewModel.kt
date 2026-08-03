package com.misticraft.admin.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.misticraft.admin.data.models.StoreSettings
import com.misticraft.admin.data.repository.SettingsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class SettingsUiState(
    val shippingFee: String = "99",
    val storeEmail: String = "",
    val storePhone: String = "",
    val defaultTransporter: String = "",
    val upiId: String = "",
    val upiPayeeName: String = "",
    val loading: Boolean = false,
    val savedMessage: String? = null,
    val error: String? = null
)

class SettingsViewModel(private val repository: SettingsRepository = SettingsRepository()) : ViewModel() {
    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState

    init {
        viewModelScope.launch {
            repository.subscribe().collect { s ->
                _uiState.value = _uiState.value.copy(
                    shippingFee = s.shippingFee.toString(),
                    storeEmail = s.storeEmail ?: "",
                    storePhone = s.storePhone ?: "",
                    defaultTransporter = s.defaultTransporter ?: "",
                    upiId = s.upiId ?: "",
                    upiPayeeName = s.upiPayeeName ?: ""
                )
            }
        }
    }

    fun update(transform: (SettingsUiState) -> SettingsUiState) {
        _uiState.value = transform(_uiState.value).copy(savedMessage = null, error = null)
    }

    fun save() {
        val s = _uiState.value
        viewModelScope.launch {
            _uiState.value = s.copy(loading = true, error = null, savedMessage = null)
            try {
                repository.save(
                    StoreSettings(
                        shippingFee = s.shippingFee.toDoubleOrNull() ?: 99.0,
                        storeEmail = s.storeEmail.trim().ifBlank { null },
                        storePhone = s.storePhone.trim().ifBlank { null },
                        defaultTransporter = s.defaultTransporter.trim().ifBlank { null },
                        upiId = s.upiId.trim().ifBlank { null },
                        upiPayeeName = s.upiPayeeName.trim().ifBlank { null }
                    )
                )
                _uiState.value = _uiState.value.copy(loading = false, savedMessage = "Saved!")
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(loading = false, error = e.message ?: "Could not save — check your connection.")
            }
        }
    }
}
