package com.misticraft.admin.ui.screens.products

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductEditScreen(productId: String?, onDone: () -> Unit, viewModel: ProductEditViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(productId) { viewModel.load(productId) }
    LaunchedEffect(state.saved) { if (state.saved) onDone() }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
            if (bytes != null) viewModel.uploadImage(bytes, uri.lastPathSegment ?: "image.jpg")
        }
    }

    Scaffold(topBar = { TopAppBar(title = { Text(if (productId == null) "Add Product" else "Edit Product") }) }) { padding ->
        Column(
            Modifier.padding(padding).fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (state.img.isNotBlank()) {
                AsyncImage(model = state.img, contentDescription = null, modifier = Modifier.size(120.dp))
            }
            OutlinedButton(onClick = { imagePicker.launch("image/*") }) {
                Text(if (state.uploading) "Uploading…" else "Choose Photo")
            }

            OutlinedTextField(value = state.name, onValueChange = { v -> viewModel.update { it.copy(name = v) } }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = state.category, onValueChange = { v -> viewModel.update { it.copy(category = v) } }, label = { Text("Category") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = state.technique, onValueChange = { v -> viewModel.update { it.copy(technique = v) } }, label = { Text("Technique") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = state.tagline, onValueChange = { v -> viewModel.update { it.copy(tagline = v) } }, label = { Text("Tagline") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = state.price, onValueChange = { v -> viewModel.update { it.copy(price = v) } }, label = { Text("Price (₹)") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = state.mrp, onValueChange = { v -> viewModel.update { it.copy(mrp = v) } }, label = { Text("MRP (₹)") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = state.stock, onValueChange = { v -> viewModel.update { it.copy(stock = v) } }, label = { Text("Stock") }, modifier = Modifier.fillMaxWidth())

            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                Text("Featured", modifier = Modifier.weight(1f))
                Switch(checked = state.featured, onCheckedChange = { v -> viewModel.update { it.copy(featured = v) } })
            }

            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }

            Button(onClick = { viewModel.save() }, enabled = !state.loading, modifier = Modifier.fillMaxWidth()) {
                if (state.loading) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp) else Text("Save")
            }
        }
    }
}
