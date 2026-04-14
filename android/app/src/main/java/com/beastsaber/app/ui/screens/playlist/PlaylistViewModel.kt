package com.beastsaber.app.ui.screens.playlist

import android.app.Application
import android.content.Intent
import androidx.core.content.FileProvider
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.beastsaber.app.data.export.playlistToExportJson
import com.beastsaber.app.data.repo.PlaylistRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class PlaylistViewModel(
    application: Application,
    private val playlist: PlaylistRepository
) : AndroidViewModel(application) {

    val items = playlist.observePlaylist().stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5000),
        emptyList()
    )

    suspend fun createShareIntent(): Intent? = withContext(Dispatchers.IO) {
        val json = playlistToExportJson(playlist.getAll())
        if (json.isBlank()) return@withContext null

        val ctx = getApplication<Application>()
        val dir = File(ctx.cacheDir, "exports").apply { mkdirs() }
        val file = File(dir, "beastsaber-map-list.json")
        file.writeText(json)

        val uri = FileProvider.getUriForFile(
            ctx,
            "${ctx.packageName}.fileprovider",
            file
        )
        Intent(Intent.ACTION_SEND).apply {
            type = "application/json"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            putExtra(Intent.EXTRA_SUBJECT, "BSLink BeatSaver map list")
        }
    }

    suspend fun exportJsonString(): String = withContext(Dispatchers.IO) {
        playlistToExportJson(playlist.getAll())
    }

    fun remove(mapId: String) {
        viewModelScope.launch {
            playlist.remove(mapId)
        }
    }

    /** Placeholder refresh for pull-to-refresh (playlist is live via Flow). */
    suspend fun refresh() {
        delay(350)
    }
}
