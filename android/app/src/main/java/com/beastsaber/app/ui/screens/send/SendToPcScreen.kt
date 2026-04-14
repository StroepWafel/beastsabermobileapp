package com.beastsaber.app.ui.screens.send

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beastsaber.app.BSLinkApplication
import com.beastsaber.app.R
import com.beastsaber.app.ui.AppViewModelFactory

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SendToPcScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val app = androidx.compose.ui.platform.LocalContext.current.applicationContext as BSLinkApplication
    val vm: SendToPcViewModel = viewModel(factory = AppViewModelFactory(app))
    val state by vm.state.collectAsState()
    var baseUrl by remember { mutableStateOf("http://192.168.1.10:3847") }
    var token by remember { mutableStateOf("") }
    var autoDownload by remember { mutableStateOf(false) }
    var showScanner by remember { mutableStateOf(false) }
    val qrInvalidMsg = stringResource(R.string.send_to_pc_qr_invalid)
    val cameraDeniedMsg = stringResource(R.string.send_to_pc_camera_denied)

    if (showScanner) {
        QrScannerOverlay(
            onDecoded = { raw ->
                val parsed = parseLanPairingQr(raw)
                if (parsed != null) {
                    baseUrl = parsed.first
                    token = parsed.second
                    showScanner = false
                    vm.clearFeedback()
                } else {
                    vm.setQrError(qrInvalidMsg)
                    showScanner = false
                }
            },
            onDismiss = { showScanner = false },
            onPermissionDenied = {
                vm.setQrError(cameraDeniedMsg)
                showScanner = false
            }
        )
        return
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.send_to_pc)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Text(
                stringResource(R.string.send_to_pc_intro),
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(Modifier.height(12.dp))
            OutlinedButton(
                onClick = {
                    vm.clearFeedback()
                    showScanner = true
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(stringResource(R.string.send_to_pc_scan_qr))
            }
            Spacer(Modifier.height(16.dp))
            Text(
                "Or enter the PC base URL and token from BSLink (LAN receiver).",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = baseUrl,
                onValueChange = { baseUrl = it },
                label = { Text("PC base URL") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = token,
                onValueChange = { token = it },
                label = { Text("Token") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Spacer(Modifier.height(16.dp))
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        stringResource(R.string.send_to_pc_auto_download),
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Text(
                        stringResource(R.string.send_to_pc_auto_download_hint),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(
                    checked = autoDownload,
                    onCheckedChange = { autoDownload = it }
                )
            }
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = { vm.send(baseUrl, token, autoDownload) },
                enabled = !state.loading && baseUrl.isNotBlank() && token.isNotBlank()
            ) {
                if (state.loading) {
                    CircularProgressIndicator(
                        Modifier.size(22.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("Send list")
                }
            }
            state.message?.let {
                Spacer(Modifier.height(12.dp))
                Text(it, color = MaterialTheme.colorScheme.primary)
            }
            state.error?.let {
                Spacer(Modifier.height(12.dp))
                Text(it, color = MaterialTheme.colorScheme.error)
            }
        }
    }
}
