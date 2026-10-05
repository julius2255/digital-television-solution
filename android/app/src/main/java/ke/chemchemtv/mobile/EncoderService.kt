package ke.chemchemtv.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.sources.audio.AudioFileSource
import com.pedro.encoder.input.sources.audio.NoAudioSource
import com.pedro.encoder.input.sources.video.BitmapSource
import com.pedro.encoder.input.sources.video.VideoFileSource
import com.pedro.library.generic.GenericStream
import java.net.URL

/**
 * Native program encoder.
 *
 * Important: there is no MediaProjection here. The phone screen is never used
 * as the video source. RootEncoder receives the actual program media URL.
 */
class EncoderService : Service(), ConnectChecker {

  companion object {
    const val ACTION_START = "ke.chemchemtv.mobile.START"
    const val ACTION_STOP = "ke.chemchemtv.mobile.STOP"
    const val ACTION_STATUS = "ke.chemchemtv.mobile.STATUS"
    const val EXTRA_ENDPOINT = "endpoint"
    const val EXTRA_MEDIA_URL = "mediaUrl"
    const val EXTRA_KIND = "kind"
    const val EXTRA_STATUS = "status"

    private const val CHANNEL_ID = "chemchem_broadcast"
    private const val NOTIFICATION_ID = 2205
  }

  private var stream: GenericStream? = null
  private var starting = false

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopEncoder()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
      }
      ACTION_START -> {
        val endpoint = intent.getStringExtra(EXTRA_ENDPOINT).orEmpty()
        val mediaUrl = intent.getStringExtra(EXTRA_MEDIA_URL).orEmpty()

        if (endpoint.isBlank() || mediaUrl.isBlank()) {
          sendStatus("ERROR: Facebook RTMPS or Program media is missing")
          stopSelf()
        } else {
          promoteToForeground()
          startEncoder(endpoint, mediaUrl)
        }
      }
    }
    return START_STICKY
  }

  private fun promoteToForeground() {
    val n = notification("CHEMCHEM TV KENYA • NATIVE ENCODER STARTING")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        n,
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      )
    } else {
      startForeground(NOTIFICATION_ID, n)
    }
  }

  private fun startEncoder(endpoint: String, mediaUrl: String) {
    if (starting || stream?.isStreaming == true) return

    starting = true
    stopEncoder()

    Thread {
      try {
        val uri = Uri.parse(mediaUrl)
        val lower = mediaUrl.substringBefore("?").lowercase()

        val newStream: GenericStream

        if (isImage(lower)) {
          val bitmap = URL(mediaUrl).openStream().use { BitmapFactory.decodeStream(it) }
            ?: throw IllegalStateException("Could not download Program image")
          newStream = GenericStream(
            applicationContext,
            this,
            BitmapSource(bitmap),
            NoAudioSource()
          )
        } else {
          val audioInfo = probeAudio(uri)
          val videoSource = VideoFileSource(applicationContext, uri, true)
          val audioSource = if (audioInfo != null) {
            AudioFileSource(applicationContext, uri, true)
          } else {
            NoAudioSource()
          }

          newStream = GenericStream(applicationContext, this, videoSource, audioSource)

          val sampleRate = audioInfo?.first ?: 44100
          val stereo = (audioInfo?.second ?: 2) >= 2

          newStream.getGlInterface().setForceRender(true, 30)

          val videoReady = newStream.prepareVideo(
            1280, 720, 3500 * 1000, fps = 30, rotation = 0
          )
          val audioReady = newStream.prepareAudio(
            sampleRate, stereo, 128 * 1000, false, false
          )

          if (!videoReady || !audioReady) {
            newStream.release()
            throw IllegalStateException("H.264/AAC encoder preparation failed")
          }

          stream = newStream
          sendStatus("PROGRAM READY")
          sendStatus("CONNECTING")
          updateNotification("CHEMCHEM TV KENYA • FACEBOOK CONNECTING")
          newStream.startStream(endpoint)
          return@Thread
        }

        newStream.getGlInterface().setForceRender(true, 30)
        val videoReady = newStream.prepareVideo(
          1280, 720, 3500 * 1000, fps = 30, rotation = 0
        )
        val audioReady = newStream.prepareAudio(
          44100, true, 128 * 1000, false, false
        )

        if (!videoReady || !audioReady) {
          newStream.release()
          throw IllegalStateException("Encoder preparation failed")
        }

        stream = newStream
        sendStatus("PROGRAM READY")
        sendStatus("CONNECTING")
        updateNotification("CHEMCHEM TV KENYA • FACEBOOK CONNECTING")
        newStream.startStream(endpoint)
      } catch (e: Exception) {
        starting = false
        sendStatus("ERROR: " + (e.message ?: "native encoder failed"))
        stopEncoder()
        stopSelf()
      }
    }.start()
  }

  private fun probeAudio(uri: Uri): Pair<Int, Int>? {
    val extractor = MediaExtractor()
    return try {
      extractor.setDataSource(this, uri, null)
      for (i in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(i)
        val mime = format.getString(MediaFormat.KEY_MIME).orEmpty()
        if (mime.startsWith("audio/")) {
          val rate = if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE))
            format.getInteger(MediaFormat.KEY_SAMPLE_RATE) else 44100
          val channels = if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT))
            format.getInteger(MediaFormat.KEY_CHANNEL_COUNT) else 2
          return Pair(rate, channels)
        }
      }
      null
    } finally {
      extractor.release()
    }
  }

  private fun isImage(url: String): Boolean =
    Regex("\\.(jpg|jpeg|png|webp|gif)$", RegexOption.IGNORE_CASE).containsMatchIn(url)

  private fun updateNotification(text: String) {
    getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification(text))
  }

  private fun stopEncoder() {
    starting = false
    try { stream?.stopStream() } catch (_: Exception) {}
    try { stream?.release() } catch (_: Exception) {}
    stream = null
  }

  private fun sendStatus(value: String) {
    sendBroadcast(
      Intent(ACTION_STATUS)
        .setPackage(packageName)
        .putExtra(EXTRA_STATUS, value)
    )
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      getSystemService(NotificationManager::class.java).createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          "CHEMCHEM TV Broadcast",
          NotificationManager.IMPORTANCE_LOW
        )
      )
    }
  }

  private fun notification(text: String): Notification {
    val stopPending = PendingIntent.getService(
      this,
      1,
      Intent(this, EncoderService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val openPending = PendingIntent.getActivity(
      this,
      2,
      Intent(this, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setContentTitle("CHEMCHEM TV KENYA")
      .setContentText(text)
      .setContentIntent(openPending)
      .setOngoing(true)
      .setSilent(true)
      .addAction(android.R.drawable.ic_media_pause, "STOP STREAM", stopPending)
      .build()
  }

  override fun onBind(intent: Intent?): IBinder? = null
  override fun onConnectionStarted(url: String) { sendStatus("CONNECTING") }
  override fun onConnectionSuccess() {
    starting = false
    sendStatus("LIVE")
    updateNotification("CHEMCHEM TV KENYA • LIVE • VIDEO + AUDIO")
  }
  override fun onNewBitrate(bitrate: Long) {
    sendStatus("LIVE • " + (bitrate / 1000) + " kbps")
  }
  override fun onConnectionFailed(reason: String) {
    starting = false
    sendStatus("ERROR: " + reason)
    updateNotification("CHEMCHEM TV KENYA • FACEBOOK ERROR")
  }
  override fun onDisconnect() {
    starting = false
    sendStatus("DISCONNECTED")
    updateNotification("CHEMCHEM TV KENYA • DISCONNECTED")
  }
  override fun onAuthError() {
    starting = false
    sendStatus("FACEBOOK KEY REJECTED")
    updateNotification("CHEMCHEM TV KENYA • FACEBOOK KEY REJECTED")
  }
  override fun onAuthSuccess() = Unit

  override fun onDestroy() {
    stopEncoder()
    super.onDestroy()
  }
}
