package com.couponwallet.shareintent

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.core.interfaces.ActivityEventListener

class ShareIntentModule : Module(), ActivityEventListener {
    // Buffer holds the most recently received shared text.
    // Cleared after JS reads it to prevent re-processing.
    private var pendingSharedText: String? = null

    override fun definition() = ModuleDefinition {
        Name("ShareIntent")

        // Read the initial intent on module creation (cold start).
        OnCreate {
            readIntentText(appContext.currentActivity?.intent)
        }

        // Also read on activity creation in case OnCreate ran before the activity existed.
        OnActivityCreated { activity: Activity, _: Bundle? ->
            readIntentText(activity.intent)
        }

        // Handle warm-start shares: singleTask launchMode routes here via onNewIntent.
        OnNewIntent { intent ->
            readIntentText(intent)
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
        if (intent.type?.startsWith("text/") != true) return

        val text = intent.getStringExtra(Intent.EXTRA_TEXT)
        if (!text.isNullOrBlank()) {
            pendingSharedText = text
        }
    }

    // ActivityEventListener fallback for additional intent delivery paths
    override fun onNewIntent(intent: Intent?) {
        readIntentText(intent)
        if (pendingSharedText != null) {
            sendEvent("onShareIntent", mapOf("text" to pendingSharedText))
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        // Not needed for share intake
    }
}
