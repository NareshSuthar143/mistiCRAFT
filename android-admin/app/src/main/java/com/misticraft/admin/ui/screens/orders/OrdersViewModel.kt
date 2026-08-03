package com.misticraft.admin.ui.screens.orders

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.misticraft.admin.data.models.CustomerOrder
import com.misticraft.admin.data.models.OrderStatus
import com.misticraft.admin.data.repository.OrdersRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class OrdersViewModel(private val repository: OrdersRepository = OrdersRepository()) : ViewModel() {
    private val _orders = MutableStateFlow<List<CustomerOrder>>(emptyList())
    val orders: StateFlow<List<CustomerOrder>> = _orders

    private val _highlightAmount = MutableStateFlow<Double?>(null)
    val highlightAmount: StateFlow<Double?> = _highlightAmount

    private val _actionError = MutableStateFlow<String?>(null)
    val actionError: StateFlow<String?> = _actionError

    init {
        viewModelScope.launch {
            repository.subscribeAll().collect { _orders.value = it }
        }
    }

    fun setHighlightAmount(amount: Double?) { _highlightAmount.value = amount }
    fun clearHighlight() { _highlightAmount.value = null }
    fun clearError() { _actionError.value = null }

    fun accept(order: CustomerOrder) = updateStatus(order.id, OrderStatus.PROCESSING)
    fun decline(order: CustomerOrder) = updateStatus(order.id, OrderStatus.CANCELLED)
    fun setStatus(order: CustomerOrder, status: String) = updateStatus(order.id, status)

    private fun updateStatus(orderId: String, status: String) {
        viewModelScope.launch {
            try {
                repository.updateStatus(orderId, status)
            } catch (e: Exception) {
                _actionError.value = e.message ?: "Could not update — check your connection."
            }
        }
    }
}
