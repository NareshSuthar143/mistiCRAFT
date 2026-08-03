package com.misticraft.admin.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.misticraft.admin.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

enum class SessionState { LOADING, LOGGED_OUT, LOGGED_IN_NOT_ADMIN, LOGGED_IN_ADMIN }

class SessionViewModel(private val authRepository: AuthRepository = AuthRepository()) : ViewModel() {
    private val _state = MutableStateFlow(SessionState.LOADING)
    val state: StateFlow<SessionState> = _state

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _state.value = SessionState.LOADING
            _state.value = when {
                authRepository.currentUserId == null -> SessionState.LOGGED_OUT
                authRepository.isCurrentUserAdmin() -> SessionState.LOGGED_IN_ADMIN
                else -> SessionState.LOGGED_IN_NOT_ADMIN
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            authRepository.signOut()
            _state.value = SessionState.LOGGED_OUT
        }
    }
}
