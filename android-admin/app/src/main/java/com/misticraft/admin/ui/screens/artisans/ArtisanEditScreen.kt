package com.misticraft.admin.ui.screens.artisans

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
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

@Composable
fun ArtisanEditScreen(artisanId: String?, onDone: () -> Unit, viewModel: ArtisanEditViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(artisanId) { viewModel.load(artisanId) }
    LaunchedEffect(state.saved) { if (state.saved) onDone() }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
            if (bytes != null) viewModel.uploadImage(bytes, uri.lastPathSegment ?: "image.jpg")
        }
    }

    Scaffold(topBar = { TopAppBar(title = { Text(if (artisanId == null) "Add Artisan" else "Edit Artisan") }) }) { padding ->
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
            OutlinedTextField(value = state.role, onValueChange = { v -> viewModel.update { it.copy(role = v) } }, label = { Text("Role") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = state.quote, onValueChange = { v -> viewModel.update { it.copy(quote = v) } }, label = { Text("Quote") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = state.tags, onValueChange = { v -> viewModel.update { it.copy(tags = v) } }, label = { Text("Tags (comma separated)") }, modifier = Modifier.fillMaxWidth())

            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }

            Button(onClick = { viewModel.save() }, enabled = !state.loading, modifier = Modifier.fillMaxWidth()) {
                if (state.loading) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp) else Text("Save")
            }
        }
    }
}
