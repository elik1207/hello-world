package com.couponwallet.shareintent

import android.content.Context
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/**
 * Package class that registers the lifecycle listener with Expo.
 * This is required for Expo to forward Activity lifecycle events
 * (onCreate, onNewIntent) to our listener.
 */
class ShareIntentPackage : Package {
    override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> {
        return listOf(ShareIntentReactActivityLifecycleListener())
    }
}
