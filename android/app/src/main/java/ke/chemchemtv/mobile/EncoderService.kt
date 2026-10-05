package ke.chemchemtv.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.sources.video.NoVideoSource
import com.pedro.library.generic.GenericStream

class EncoderService : Service(), ConnectChecker {
  companion object {
    const val ACTION_START = "ke.chemchemtv.mobile.START"
    const val ACTION_STOP = "ke.chemchemtv.mobile.STOP"
    const val ACTION_STATUS = "ke.chemchemtv.mobile.STATUS"
    const val EXTRA_ENDPOINT = "endpoint"
    const val EXTRA_MEDIA_URL = "mediaUrl"
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
          sendStatus("ERROR: no stream URL or media URL")
          stopSelf()
        } else {
          startForeground(NOTIFICATION_ID, notification("CHEMCHEM TV KENYA • STREAMING"))
          startEncoder(endpoint, mediaUrl)
        }
      }
    }
    return START_STICKY
  }

  private fun startEncoder(endpoint: String, mediaUrl: String) {
    if (starting || stream?.isStreaming == true) return
    starting = true
    stopEncoder()
    try {
      val source = MediaPlayerVideoSource(applicationContext, mediaUrl)
      val newStream = GenericStream(applicationContext, this, NoVideoSource(), SilentAudioSource())
      newStream.getGlInterface().setForceRender(true, 30)
      val videoReady = newStream.prepareVideo(1280, 720, 3500 * 1000, rotation = 0)
      val audioReady = newStream.prepareAudio(44100, true, 96 * 1000, false, false)
      if (!videoReady || !audioReady) {
        newStream.release()
        throw IllegalStateException("H.264/AAC encoder preparation failed")
      }
      newStream.changeVideoSource(source)
      stream = newStream
      sendStatus("CONNECTING")
      newStream.startStream(endpoint)
    } catch (e: Exception) {
      starting = false
      sendStatus("ERROR: ${e.message ?: "encoder failed"}")
      stopSelf()
    }
  }

  private fun stopEncoder() {
    starting = false
    try { stream?.stopStream() } catch (_: Exception) {}
    try { stream?.release() } catch (_: Exception) {}
    stream = null
  }

  private fun sendStatus(value: String) {
    sendBroadcast(Intent(ACTION_STATUS).setPackage(packageName).putExtra(EXTRA_STATUS, value))
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      getSystemService(NotificationManager::class.java).createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "CHEMCHEM TV Broadcast", NotificationManager.IMPORTANCE_LOW)
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

  override fun onBind(intent: Intent?) = null
  override fun onConnectionStarted(url: String) = sendStatus("CONNECTING")
  override fun onConnectionSuccess() { starting = false; sendStatus("LIVE") }
  override fun onNewBitrate(bitrate: Long) = sendStatus("LIVE • ${bitrate / 1000} kbps")
  override fun onConnectionFailed(reason: String) { starting = false; sendStatus("ERROR: $reason") }
  override fun onDisconnect() { starting = false; sendStatus("DISCONNECTED") }
  override fun onAuthError() { starting = false; sendStatus("FACEBOOK KEY REJECTED") }
  override fun onAuthSuccess() = Unit

  override fun onDestroy() {
    stopEncoder()
    super.onDestroy()
  }
}
