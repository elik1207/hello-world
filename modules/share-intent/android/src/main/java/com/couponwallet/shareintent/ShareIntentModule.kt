package com.couponwallet.shareintent

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ShareIntentModule : Module() {
    // Buffer holds the most recently received shared text.
    // Cleared after JS reads it to prevent re-processing.
    private var pendingSharedText: String? = null

    override fun definition() = ModuleDefinition {
        Name("ShareIntent")

        // Called once when the module is created.
        // Reads the initial intent if the app was cold-started via share.
        OnCreate {
            readIntentText(appContext.currentActivity?.intent)
        }

        // Called when a new intent arrives while the app is already running (warm start).
        OnNewIntent { intent ->
            readIntentText(intent)
            // Emit event to JS so the listener can pick it up.
            if (pendingSharedText != null) {
                sendEvent("onShareIntent", mapOf("text" to pendingSharedText))
            }
        }

        // JS-callable: returns the pending shared text (or null).
        AsyncFunction("getSharedText") {
            return@AsyncFunction pendingSharedText
        }

        // JS-callable: clears the buffer so we don't re-process the same text.
        Function("clearSharedText") {
            pendingSharedText = null
        }

        // Event that JS can subscribe to for warm-start share events.
        Events("onShareIntent")
    }

    /**
     * Extracts EXTRA_TEXT from an ACTION_SEND intent.
     * Only processes text/plain MIME type.
     */
    private fun readIntentText(intent: Intent?) {
        if (intent == null) return
        if (intent.action != Intent.ACTION_SEND) return
        if (intent.type != "text/plain") return

        val text = intent.getStringExtra(Intent.EXTRA_TEXT)
        if (!text.isNullOrBlank()) {
            pendingSharedText = text
        }
    }
}
