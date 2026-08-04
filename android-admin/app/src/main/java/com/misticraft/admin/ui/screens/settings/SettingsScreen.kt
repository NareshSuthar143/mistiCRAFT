package com.misticraft.admin.ui.screens.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: SettingsViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(topBar = { TopAppBar(title = { Text("Store Settings") }) }) { padding ->
        Column(
            Modifier.padding(padding).fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedTextField(value = state.shippingFee, onValueChange = { v -> viewModel.update { it.copy(shippingFee = v) } }, label = { Text("Shipping Fee (₹)") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = state.storeEmail, onValueChange = { v -> viewModel.update { it.copy(storeEmail = v) } }, label = { Text("Store Contact Email") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = state.storePhone, onValueChange = { v -> viewModel.update { it.copy(storePhone = v) } }, label = { Text("Store Contact Phone") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = state.defaultTransporter, onValueChange = { v -> viewModel.update { it.copy(defaultTransporter = v) } }, label = { Text("Default Transporter Name") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = state.upiId, onValueChange = { v -> viewModel.update { it.copy(upiId = v) } }, label = { Text("UPI ID (VPA)") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = state.upiPayeeName, onValueChange = { v -> viewModel.update { it.copy(upiPayeeName = v) } }, label = { Text("Payee Name (shown to customers)") }, modifier = Modifier.fillMaxWidth())

            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            state.savedMessage?.let { Text(it, color = MaterialTheme.colorScheme.primary) }

            Button(onClick = { viewModel.save() }, enabled = !state.loading, modifier = Modifier.fillMaxWidth()) {
                Text("Save Settings")
            }
        }
    }
}
