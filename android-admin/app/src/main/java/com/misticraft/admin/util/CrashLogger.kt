package com.misticraft.admin.util

import android.content.Context
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter

/**
 * There's no adb/logcat access to this project's target devices
 * (phone-only, no PC, no root), so a crash otherwise only ever shows
 * up as an opaque "keeps stopping" dialog. This persists the last
 * uncaught exception's stack trace to a file so MainActivity can
 * display it on the next launch instead.
 */
object CrashLogger {
    private const val FILE_NAME = "last_crash.txt"

    fun install(context: Context) {
        val appContext = context.applicationContext
        val previousHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                val writer = StringWriter()
                throwable.printStackTrace(PrintWriter(writer))
                File(appContext.filesDir, FILE_NAME).writeText(writer.toString())
            } catch (_: Throwable) {
                // Best-effort — never let the logger itself block the crash.
            }
            previousHandler?.uncaughtException(thread, throwable)
        }
    }

    fun readLastCrash(context: Context): String? {
        val file = File(context.applicationContext.filesDir, FILE_NAME)
        return if (file.exists()) file.readText() else null
    }

    fun clear(context: Context) {
        File(context.applicationContext.filesDir, FILE_NAME).delete()
    }
}
