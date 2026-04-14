package com.beastsaber.app.ui.screens.detail

import android.content.Intent
import android.net.Uri
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.beastsaber.app.BSLinkApplication
import com.beastsaber.app.data.model.displaySongName
import com.beastsaber.app.data.model.mapKeyForViewer
import com.beastsaber.app.data.model.primaryVersion
import com.beastsaber.app.ui.AppViewModelFactory
import com.beastsaber.app.ui.components.TrackWindowVisibility

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapDetailScreen(
    mapId: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val app = LocalContext.current.applicationContext as BSLinkApplication
    val vm: MapDetailViewModel = viewModel(factory = AppViewModelFactory(app))
    val state by vm.state.collectAsState()
    val snack = remember { SnackbarHostState() }

    LaunchedEffect(mapId) {
        vm.load(mapId)
    }

    LaunchedEffect(state.addedMessage) {
        state.addedMessage?.let {
            snack.showSnackbar(it)
            vm.clearMessage()
        }
    }

    BackHandler { onBack() }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(state.map?.displaySongName() ?: "Map") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snack) }
    ) { padding ->
        when {
            state.loading && state.map == null -> {
                Box(
                    Modifier
                        .fillMaxSize()
                        .padding(padding)
                ) {
                    CircularProgressIndicator(Modifier.align(Alignment.Center))
                }
            }

            state.error != null -> {
                Text(
                    state.error ?: "",
                    modifier = Modifier.padding(padding).padding(16.dp)
                )
            }

            state.map != null -> {
                val map = state.map!!
                val v = map.primaryVersion()
                val preview = v?.previewURL
                val viewerUrl = "https://allpoland.github.io/ArcViewer/?id=${map.mapKeyForViewer()}"
                val context = LocalContext.current

                Column(
                    Modifier
                        .padding(padding)
                        .verticalScroll(rememberScrollState())
                ) {
                    Text(
                        map.metadata?.songAuthorName.orEmpty(),
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                    )
                    Text(
                        "Mapper: ${map.metadata?.levelAuthorName.orEmpty()}",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                    )

                    if (preview != null) {
                        AudioPreview(url = preview)
                    }

                    Text(
                        "Map preview (ArcViewer)",
                        style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.padding(16.dp)
                    )
                    ArcViewerWeb(
                        url = viewerUrl,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(360.dp)
                    )

                    Button(
                        onClick = {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(viewerUrl))
                            context.startActivity(intent)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp)
                    ) {
                        Text("Open preview in browser")
                    }

                    Button(
                        onClick = { vm.addToPlaylist() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                    ) {
                        Text("Add to My list")
                    }
                }
            }
        }
    }
}

@Composable
private fun AudioPreview(url: String) {
    val context = LocalContext.current
    val player = remember {
        ExoPlayer.Builder(context).build()
    }
    var windowVisible by remember { mutableStateOf(true) }
    LaunchedEffect(url) {
        player.setMediaItem(MediaItem.fromUri(url))
        player.prepare()
        player.playWhenReady = false
    }
    LaunchedEffect(windowVisible) {
        if (!windowVisible) player.pause()
    }
    DisposableEffect(Unit) {
        onDispose { player.release() }
    }
    TrackWindowVisibility(
        onVisibilityChange = { windowVisible = it },
        modifier = Modifier
            .fillMaxWidth()
            .height(120.dp)
    ) {
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    )
                    this.player = player
                }
            },
            modifier = Modifier.fillMaxSize()
        )
    }
}

private fun releaseArcViewerWebView(wv: WebView) {
    try {
        wv.stopLoading()
        wv.loadUrl("about:blank")
        wv.onPause()
        wv.removeAllViews()
        wv.destroy()
    } catch (_: Exception) {
    }
}

@Composable
private fun ArcViewerWeb(url: String, modifier: Modifier = Modifier) {
    var windowVisible by remember { mutableStateOf(true) }
    TrackWindowVisibility(
        onVisibilityChange = { windowVisible = it },
        modifier = modifier
    ) {
        AndroidView(
            factory = { context ->
                WebView(context).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    webViewClient = WebViewClient()
                    loadUrl(url)
                }
            },
            modifier = Modifier.fillMaxSize(),
            update = { wv ->
                if (windowVisible) wv.onResume() else wv.onPause()
                if (wv.url != url) wv.loadUrl(url)
            },
            onRelease = { wv -> releaseArcViewerWebView(wv) }
        )
    }
}
