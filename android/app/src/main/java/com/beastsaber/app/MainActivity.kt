package com.beastsaber.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beastsaber.app.BSLinkApplication
import com.beastsaber.app.R
import com.beastsaber.app.ui.AppViewModelFactory
import com.beastsaber.app.ui.audio.AudioPreviewViewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.beastsaber.app.ui.screens.browse.BrowseScreen
import com.beastsaber.app.ui.screens.detail.MapDetailScreen
import com.beastsaber.app.ui.screens.playlist.PlaylistScreen
import com.beastsaber.app.ui.screens.search.SearchScreen
import com.beastsaber.app.ui.screens.send.SendToPcScreen
import com.beastsaber.app.ui.theme.BSLinkTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            BSLinkTheme {
                BSLinkNav()
            }
        }
    }
}

@Composable
private fun BSLinkNav() {
    val app = LocalContext.current.applicationContext as BSLinkApplication
    val activity = LocalContext.current as ComponentActivity
    val audioPreview: AudioPreviewViewModel = viewModel(
        factory = AppViewModelFactory(app),
        viewModelStoreOwner = activity
    )
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    LaunchedEffect(currentRoute) {
        audioPreview.stop()
    }
    val showBottomBar = currentRoute in listOf("latest", "search", "playlist")

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    NavigationBarItem(
                        selected = currentRoute == "latest",
                        onClick = {
                            navController.navigate("latest") {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(Icons.Default.Home, contentDescription = null) },
                        label = { Text(stringResource(R.string.nav_latest)) }
                    )
                    NavigationBarItem(
                        selected = currentRoute == "search",
                        onClick = {
                            navController.navigate("search") {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(Icons.Default.Search, contentDescription = null) },
                        label = { Text(stringResource(R.string.nav_search)) }
                    )
                    NavigationBarItem(
                        selected = currentRoute == "playlist",
                        onClick = {
                            navController.navigate("playlist") {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(Icons.AutoMirrored.Filled.List, contentDescription = null) },
                        label = { Text(stringResource(R.string.nav_playlist)) }
                    )
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = "latest",
            modifier = Modifier.padding(padding)
        ) {
            composable("latest") {
                BrowseScreen(
                    onOpenMap = { id -> navController.navigate("detail/$id") },
                    audioPreview = audioPreview
                )
            }
            composable("search") {
                SearchScreen(
                    onOpenMap = { id -> navController.navigate("detail/$id") },
                    audioPreview = audioPreview
                )
            }
            composable("playlist") {
                PlaylistScreen(
                    onSendToPc = { navController.navigate("send") },
                    onOpenMap = { id -> navController.navigate("detail/$id") }
                )
            }
            composable("detail/{id}") { backStackEntry ->
                val id = backStackEntry.arguments?.getString("id")!!
                MapDetailScreen(
                    mapId = id,
                    onBack = { navController.popBackStack() }
                )
            }
            composable("send") {
                SendToPcScreen(onBack = { navController.popBackStack() })
            }
        }
    }
}
