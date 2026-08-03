package com.misticraft.admin.ui.screens.orders

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.misticraft.admin.data.models.CustomerOrder
import com.misticraft.admin.data.models.OrderStatus
import kotlinx.coroutines.launch

@Composable
fun OrdersScreen(initialHighlightAmount: Double?, viewModel: OrdersViewModel = viewModel()) {
    val orders by viewModel.orders.collectAsState()
    val highlightAmount by viewModel.highlightAmount.collectAsState()
    val actionError by viewModel.actionError.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    LaunchedEffect(initialHighlightAmount) {
        if (initialHighlightAmount != null) viewModel.setHighlightAmount(initialHighlightAmount)
    }
    LaunchedEffect(actionError) {
        actionError?.let {
            scope.launch { snackbarHostState.showSnackbar(it) }
            viewModel.clearError()
        }
    }

    var orderPendingDecline by remember { mutableStateOf<CustomerOrder?>(null) }

    val displayedOrders = if (highlightAmount != null) {
        orders.filter { it.total == highlightAmount }
    } else orders

    Scaffold(
        topBar = { TopAppBar(title = { Text("Orders") }) },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            if (highlightAmount != null) {
                Row(
                    Modifier.fillMaxWidth().padding(12.dp),
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        "Filtered to ₹${highlightAmount!!.toInt()} from a payment alert",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    IconButton(onClick = { viewModel.clearHighlight() }) {
                        Icon(Icons.Filled.Close, contentDescription = "Clear filter")
                    }
                }
            }

            if (displayedOrders.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) {
                    Text("No orders yet — they'll appear here the moment someone checks out.")
                }
            } else {
                LazyColumn(
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(displayedOrders, key = { it.id }) { order ->
                        OrderCard(
                            order = order,
                            onAccept = { viewModel.accept(order) },
                            onDecline = { orderPendingDecline = order },
                            onStatusChange = { status -> viewModel.setStatus(order, status) }
                        )
                    }
                }
            }
        }
    }

    orderPendingDecline?.let { order ->
        AlertDialog(
            onDismissRequest = { orderPendingDecline = null },
            title = { Text("Decline this order?") },
            text = { Text("Order ${order.orderNumber} will be marked Cancelled.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.decline(order)
                    orderPendingDecline = null
                }) { Text("Decline") }
            },
            dismissButton = {
                TextButton(onClick = { orderPendingDecline = null }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun OrderCard(
    order: CustomerOrder,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onStatusChange: (String) -> Unit
) {
    Card(elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(order.orderNumber, style = MaterialTheme.typography.titleMedium)
                Text("₹${order.total.toInt()}", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            }

            val customerLine = order.contact.email?.takeIf { it.isNotBlank() }
                ?: order.address.name?.takeIf { it.isNotBlank() }
                ?: "Guest"
            Text(customerLine, style = MaterialTheme.typography.bodyMedium)

            val itemsSummary = order.items.joinToString(", ") { "${it.qty}× ${it.name}" }
            if (itemsSummary.isNotBlank()) {
                Text(itemsSummary, style = MaterialTheme.typography.bodyMedium, maxLines = 2)
            }

            val utr = order.payment.utr
            Text(
                text = if (!utr.isNullOrBlank()) "UTR: $utr" else "No UTR on file",
                style = MaterialTheme.typography.bodyMedium,
                color = if (!utr.isNullOrBlank()) MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f) else MaterialTheme.colorScheme.error
            )

            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AssistChip(onClick = {}, label = { Text(order.status) })
            }

            if (order.status == OrderStatus.PENDING) {
                Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = onAccept, modifier = Modifier.weight(1f)) { Text("Accept") }
                    OutlinedButton(onClick = onDecline, modifier = Modifier.weight(1f)) { Text("Decline") }
                }
            } else {
                Row(Modifier.padding(top = 12.dp)) {
                    OrderStatus.ALL.filter { it != order.status }.forEach { status ->
                        TextButton(onClick = { onStatusChange(status) }) { Text("Mark $status") }
                    }
                }
            }
        }
    }
}
