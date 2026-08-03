package com.misticraft.admin.ui.screens.founders

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.misticraft.admin.data.models.Founder
import com.misticraft.admin.data.repository.FoundersRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class FoundersViewModel(private val repository: FoundersRepository = FoundersRepository()) : ViewModel() {
    private val _founders = MutableStateFlow<List<Founder>>(emptyList())
    val founders: StateFlow<List<Founder>> = _founders

    init {
        viewModelScope.launch { repository.subscribeAll().collect { _founders.value = it } }
    }

    fun delete(id: String) {
        viewModelScope.launch { repository.delete(id) }
    }
}
