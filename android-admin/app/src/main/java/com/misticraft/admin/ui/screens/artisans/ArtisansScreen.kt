package com.misticraft.admin.ui.screens.artisans

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.misticraft.admin.data.models.Artisan

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArtisansScreen(onEdit: (String?) -> Unit, viewModel: ArtisansViewModel = viewModel()) {
    val artisans by viewModel.artisans.collectAsState()
    var pendingDelete by remember { mutableStateOf<Artisan?>(null) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Artisans") }) },
        floatingActionButton = {
            FloatingActionButton(onClick = { onEdit(null) }) { Icon(Icons.Filled.Add, contentDescription = "Add artisan") }
        }
    ) { padding ->
        LazyColumn(
            contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.padding(padding).fillMaxSize()
        ) {
            items(artisans, key = { it.id }) { artisan ->
                Card {
                    Row(Modifier.padding(12.dp).fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        AsyncImage(
                            model = artisan.img,
                            contentDescription = artisan.name,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.size(56.dp).clip(CircleShape)
                        )
                        Column(Modifier.padding(start = 12.dp).weight(1f)) {
                            Text(artisan.name, style = MaterialTheme.typography.titleMedium)
                            Text(artisan.role ?: "", style = MaterialTheme.typography.bodyMedium)
                        }
                        IconButton(onClick = { onEdit(artisan.id) }) { Icon(Icons.Filled.Edit, contentDescription = "Edit") }
                        IconButton(onClick = { pendingDelete = artisan }) { Icon(Icons.Filled.Delete, contentDescription = "Delete") }
                    }
                }
            }
        }
    }

    pendingDelete?.let { artisan ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("Remove \"${artisan.name}\"?") },
            confirmButton = {
                TextButton(onClick = { viewModel.delete(artisan.id); pendingDelete = null }) { Text("Remove") }
            },
            dismissButton = { TextButton(onClick = { pendingDelete = null }) { Text("Cancel") } }
        )
    }
}
