package com.misticraft.admin.ui.screens.artisans

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.misticraft.admin.data.models.Artisan
import com.misticraft.admin.data.repository.ArtisansRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class ArtisansViewModel(private val repository: ArtisansRepository = ArtisansRepository()) : ViewModel() {
    private val _artisans = MutableStateFlow<List<Artisan>>(emptyList())
    val artisans: StateFlow<List<Artisan>> = _artisans

    init {
        viewModelScope.launch { repository.subscribeAll().collect { _artisans.value = it } }
    }

    fun delete(id: String) {
        viewModelScope.launch { repository.delete(id) }
    }
}
