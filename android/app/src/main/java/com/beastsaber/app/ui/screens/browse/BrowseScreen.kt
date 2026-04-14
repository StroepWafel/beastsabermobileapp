package com.beastsaber.app.ui.screens.browse

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beastsaber.app.BSLinkApplication
import com.beastsaber.app.R
import com.beastsaber.app.data.model.primaryVersion
import com.beastsaber.app.data.repo.LatestFeedSort
import com.beastsaber.app.data.repo.MapFilterFormState
import com.beastsaber.app.ui.AppViewModelFactory
import com.beastsaber.app.ui.audio.AudioPreviewViewModel
import com.beastsaber.app.ui.components.BeatSaverFilterSheetContent
import com.beastsaber.app.ui.components.MapRow

@OptIn(ExperimentalMaterial3Api::class, ExperimentalMaterialApi::class)
@Composable
fun BrowseScreen(
    onOpenMap: (String) -> Unit,
    audioPreview: AudioPreviewViewModel,
    modifier: Modifier = Modifier
) {
    val app = LocalContext.current.applicationContext as BSLinkApplication
    val vm: BrowseViewModel = viewModel(factory = AppViewModelFactory(app))
    val state by vm.state.collectAsState()
    val audioState by audioPreview.state.collectAsState()
    val listState = rememberLazyListState()
    val snack = remember { SnackbarHostState() }
    var filtersOpen by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var draftFilters by remember { mutableStateOf(MapFilterFormState()) }

    LaunchedEffect(filtersOpen) {
        if (filtersOpen) draftFilters = state.filters
    }

    LaunchedEffect(state.error) {
        state.error?.let { snack.showSnackbar(it) }
    }

    val context = LocalContext.current
    LaunchedEffect(state.playlistAddResult) {
        val ok = state.playlistAddResult ?: return@LaunchedEffect
        snack.showSnackbar(
            context.getString(
                if (ok) R.string.playlist_added else R.string.playlist_add_failed
            )
        )
        vm.clearPlaylistAddResult()
    }

    // listState identity does not change when scrolling — snapshotFlow tracks scroll + list state for infinite load.
    LaunchedEffect(vm, listState) {
        snapshotFlow {
            val info = listState.layoutInfo
            val last = info.visibleItemsInfo.lastOrNull()?.index ?: 0
            val total = info.totalItemsCount
            Triple(last, total, state)
        }.collect { (last, total, s) ->
            if (s.items.isNotEmpty() &&
                total > 0 &&
                last >= total - 5 &&
                !s.loading &&
                !s.endReached
            ) {
                vm.loadMore()
            }
        }
    }

    LaunchedEffect(listState, audioPreview) {
        snapshotFlow {
            listState.layoutInfo.visibleItemsInfo.map { it.key }.toSet()
        }.collect { visibleKeys ->
            val activeId = audioPreview.state.value.activeMapId ?: return@collect
            if (activeId !in visibleKeys) {
                audioPreview.stop()
            }
        }
    }

    val filterBadgeActive = state.filters.activeFilterCount() > 0
    val pullRefreshing = state.loading && state.items.isNotEmpty()
    val pullRefreshState = rememberPullRefreshState(pullRefreshing, onRefresh = { vm.refresh() })

    if (filtersOpen) {
        ModalBottomSheet(
            onDismissRequest = { filtersOpen = false },
            sheetState = sheetState
        ) {
            BeatSaverFilterSheetContent(
                filters = draftFilters,
                onFiltersChange = { draftFilters = it },
                showSortOrder = false,
                sortOrder = null,
                onSortOrderChange = null,
                titleRes = R.string.browse_filters_title,
                onClearFilters = { draftFilters = MapFilterFormState.cleared() },
                applyButtonLabelRes = R.string.apply_browse_filters,
                onApply = {
                    vm.applyFiltersFromSheet(draftFilters)
                    filtersOpen = false
                },
                modifier = Modifier
                    .padding(horizontal = 16.dp)
                    .navigationBarsPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = 24.dp)
            )
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.browse_title)) },
                actions = {
                    IconButton(onClick = { filtersOpen = true }) {
                        BadgedBox(
                            badge = {
                                if (filterBadgeActive) {
                                    Badge()
                                }
                            }
                        ) {
                            Icon(Icons.Default.FilterList, contentDescription = stringResource(R.string.browse_filters_title))
                        }
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snack) }
    ) { padding ->
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .pullRefresh(pullRefreshState)
        ) {
            if (state.items.isEmpty() && state.loading) {
                CircularProgressIndicator(Modifier.align(Alignment.Center))
            } else {
                Column(Modifier.fillMaxSize()) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .background(MaterialTheme.colorScheme.surface)
                    ) {
                        Text(
                            stringResource(R.string.sort_order),
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(
                                start = 16.dp,
                                top = 8.dp,
                                end = 16.dp,
                                bottom = 4.dp
                            )
                        )
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState())
                                .padding(horizontal = 16.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            LatestFeedSort.entries.forEach { option ->
                                FilterChip(
                                    selected = state.feedSort == option,
                                    onClick = { vm.setFeedSort(option) },
                                    label = { Text(option.label) }
                                )
                            }
                        }
                    }
                    LazyColumn(
                        state = listState,
                        modifier = Modifier
                            .fillMaxWidth()
                            .fillMaxHeight(),
                        contentPadding = PaddingValues(bottom = 24.dp)
                    ) {
                    item {
                        Column(Modifier.padding(bottom = 8.dp)) {
                            if (state.filters.hasNonDefaultFilters() || state.feedSort == LatestFeedSort.Rating) {
                                Text(
                                    stringResource(R.string.browse_filtered_hint),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                                )
                            }
                            Text(
                                stringResource(R.string.attribution_beatsaver),
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                            )
                        }
                    }
                    items(state.items, key = { it.id }) { map ->
                        val url = map.primaryVersion()?.previewURL
                        MapRow(
                            map = map,
                            onClick = { onOpenMap(map.id) },
                            onPreviewClick = if (url != null) {
                                { audioPreview.toggle(map.id, url) }
                            } else {
                                null
                            },
                            previewShowsPause = audioState.activeMapId == map.id && audioState.isPlaying,
                            onAddToPlaylistClick = { vm.addToPlaylist(map) }
                        )
                    }
                    if (state.loading && state.items.isNotEmpty()) {
                        item {
                            Box(
                                Modifier
                                    .fillMaxSize()
                                    .padding(16.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator()
                            }
                        }
                    }
                    }
                }
            }
            PullRefreshIndicator(
                refreshing = pullRefreshing,
                state = pullRefreshState,
                modifier = Modifier.align(Alignment.TopCenter)
            )
        }
    }
}
