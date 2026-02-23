package com.couponwallet.shareintent

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/**
 * Lifecycle listener that hooks into the React Activity to capture
 * ACTION_SEND intents on both cold start (onCreate) and warm start (onNewIntent).
 * Stores the shared text in ShareIntentModule.companion for JS to read.
 */
class ShareIntentReactActivityLifecycleListener : ReactActivityLifecycleListener {

    override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
        activity?.intent?.let { readIntentText(it) }
    }

    override fun onNewIntent(intent: Intent?): Boolean {
        if (intent != null) {
            readIntentText(intent)
            // Notify observers (the Module) that new text arrived
            ShareIntentModule.notifyNewShare()
        }
        return false // Don't consume the intent; let other handlers process it too
    }

    private fun readIntentText(intent: Intent) {
        if (intent.action != Intent.ACTION_SEND) return
        if (intent.type?.startsWith("text/") != true) return

        val text = intent.getStringExtra(Intent.EXTRA_TEXT)
        if (!text.isNullOrBlank()) {
            ShareIntentModule.pendingText = text
        }
    }
}
