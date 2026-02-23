package com.couponwallet.shareintent

import androidx.core.os.bundleOf
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference

/**
 * Expo Module that exposes share intent data to JavaScript.
 * 
 * The lifecycle listener (ShareIntentReactActivityLifecycleListener) captures
 * the shared text and stores it in the companion object. This module provides
 * JS-callable functions to read and clear that buffer, plus an event for
 * warm-start notifications.
 * 
 * Architecture:
 *   ReactActivity → onNewIntent/onCreate → ShareIntentReactActivityLifecycleListener
 *   → companion object (pendingText) → ShareIntentModule → JS
 */
class ShareIntentModule : Module() {

    companion object {
        // Shared buffer: written by the lifecycle listener, read by the module.
        @Volatile
        var pendingText: String? = null

        // Observers: modules register to be notified when new share text arrives.
        val observers: MutableSet<WeakReference<ShareIntentModule>> = mutableSetOf()

        fun notifyNewShare() {
            val text = pendingText ?: return
            observers.forEach { ref ->
                ref.get()?.sendEvent("onShareIntent", bundleOf("text" to text))
            }
        }
    }

    override fun definition() = ModuleDefinition {
        Name("ShareIntent")

        Events("onShareIntent")

        // JS-callable: returns the pending shared text (or null).
        AsyncFunction("getSharedText") {
            return@AsyncFunction pendingText
        }

        // JS-callable: clears the buffer to prevent re-processing.
        Function("clearSharedText") {
            pendingText = null
        }

        // Register this module instance as an observer for warm-start events.
        OnStartObserving("onShareIntent") {
            observers.add(WeakReference(this@ShareIntentModule))
        }

        OnStopObserving("onShareIntent") {
            observers.removeAll { it.get() == null || it.get() == this@ShareIntentModule }
        }

        // On module creation, also try to read the current activity's intent
        // in case the lifecycle listener hasn't fired yet.
        OnCreate {
            observers.add(WeakReference(this@ShareIntentModule))
            val intent = appContext.currentActivity?.intent
            if (intent != null && pendingText == null) {
                if (intent.action == android.content.Intent.ACTION_SEND &&
                    intent.type?.startsWith("text/") == true) {
                    val text = intent.getStringExtra(android.content.Intent.EXTRA_TEXT)
                    if (!text.isNullOrBlank()) {
                        pendingText = text
                    }
                }
            }
        }
    }
}
