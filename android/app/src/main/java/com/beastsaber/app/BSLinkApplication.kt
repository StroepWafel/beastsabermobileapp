package com.beastsaber.app

import android.app.Application
import com.beastsaber.app.data.db.PlaylistDatabase

class BSLinkApplication : Application() {
    val database by lazy { PlaylistDatabase.get(this) }
}
