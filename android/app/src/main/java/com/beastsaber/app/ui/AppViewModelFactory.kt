package com.beastsaber.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.beastsaber.app.BSLinkApplication
import com.beastsaber.app.data.network.NetworkModule
import com.beastsaber.app.data.repo.BeatSaverRepository
import com.beastsaber.app.data.repo.PlaylistRepository
import com.beastsaber.app.ui.screens.browse.BrowseViewModel
import com.beastsaber.app.ui.screens.detail.MapDetailViewModel
import com.beastsaber.app.ui.screens.playlist.PlaylistViewModel
import com.beastsaber.app.ui.audio.AudioPreviewViewModel
import com.beastsaber.app.ui.screens.search.SearchViewModel
import com.beastsaber.app.ui.screens.send.SendToPcViewModel

class AppViewModelFactory(
    private val application: BSLinkApplication
) : ViewModelProvider.Factory {

    private val beatSaver: BeatSaverRepository by lazy {
        BeatSaverRepository(NetworkModule.api)
    }
    private val playlist: PlaylistRepository by lazy {
        PlaylistRepository(application.database.playlistDao())
    }

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = when {
        modelClass.isAssignableFrom(BrowseViewModel::class.java) ->
            BrowseViewModel(beatSaver, playlist) as T
        modelClass.isAssignableFrom(SearchViewModel::class.java) ->
            SearchViewModel(application, beatSaver, playlist) as T
        modelClass.isAssignableFrom(AudioPreviewViewModel::class.java) ->
            AudioPreviewViewModel(application) as T
        modelClass.isAssignableFrom(MapDetailViewModel::class.java) ->
            MapDetailViewModel(beatSaver, playlist) as T
        modelClass.isAssignableFrom(PlaylistViewModel::class.java) ->
            PlaylistViewModel(application, playlist) as T
        modelClass.isAssignableFrom(SendToPcViewModel::class.java) ->
            SendToPcViewModel(playlist) as T
        else -> throw IllegalArgumentException("Unknown VM ${modelClass.name}")
    }
}
