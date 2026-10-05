package ke.chemchemtv.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Parcelable
import android.os.Handler
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.sources.audio.InternalAudioSource
import com.pedro.encoder.input.sources.video.ScreenSource
import com.pedro.library.generic.GenericStream

class EncoderService : Service(), ConnectChecker {
  companion object {
    const val ACTION_START = "ke.chemchemtv.mobile.START"
    const val ACTION_STOP = "ke.chemchemtv.mobile.STOP"
    const val ACTION_STATUS = "ke.chemchemtv.mobile.STATUS"
    const val EXTRA_ENDPOINT = "endpoint"
    const val EXTRA_RESULT_CODE = "projectionResultCode"
    const val EXTRA_PROJECTION_DATA = "projectionData"
    const val EXTRA_STATUS = "status"
    private const val CHANNEL_ID = "chemchem_broadcast"
    private const val NOTIFICATION_ID = 2205
  }

  private var stream: GenericStream? = null
  private var mediaProjection: MediaProjection? = null
  private var starting = false

  private val projectionCallback = object : MediaProjection.Callback() {
    override fun onStop() {
      sendStatus("CAPTURE STOPPED")
      stopEncoder()
      stopSelf()
    }
  }

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
        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
        val projectionData = getProjectionIntent(intent)

        if (endpoint.isBlank() || projectionData == null || resultCode == 0) {
          sendStatus("ERROR: missing Facebook RTMPS or capture permission")
          stopSelf()
        } else {
          promoteToForeground()
          startEncoder(endpoint, resultCode, projectionData)
        }
      }
    }
    return START_STICKY
  }

  private fun promoteToForeground() {
    val n = notification("CHEMCHEM TV KENYA • ENCODER STARTING")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        n,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION or
          ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      )
    } else {
      startForeground(NOTIFICATION_ID, n)
    }
  }

  @Suppress("DEPRECATION")
  private fun getProjectionIntent(intent: Intent): Intent? {
    return if (Build.VERSION.SDK_INT >= 33) {
      intent.getParcelableExtra(EXTRA_PROJECTION_DATA, Intent::class.java)
    } else {
      intent.getParcelableExtra(EXTRA_PROJECTION_DATA)
    }
  }

  private fun startEncoder(endpoint: String, resultCode: Int, projectionData: Intent) {
    if (starting || stream?.isStreaming == true) return

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      sendStatus("ERROR: internal program audio needs Android 10+")
      stopSelf()
      return
    }

    starting = true
    stopEncoder()

    try {
      val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      val projection = manager.getMediaProjection(resultCode, projectionData)
        ?: throw IllegalStateException("Android capture permission was not granted")

      mediaProjection = projection
      projection.registerCallback(projectionCallback, Handler(Looper.getMainLooper()))

      val newStream = GenericStream(
        applicationContext,
        this,
        ScreenSource(applicationContext, projection),
        InternalAudioSource(projection)
      )

      newStream.getGlInterface().setForceRender(true, 30)

      val videoReady = newStream.prepareVideo(1280, 720, 3500 * 1000, rotation = 0)
      val audioReady = newStream.prepareAudio(44100, true, 128 * 1000, false, false)

      if (!videoReady || !audioReady) {
        newStream.release()
        throw IllegalStateException("H.264/AAC encoder preparation failed")
      }

      stream = newStream
      sendStatus("CAPTURE READY")
      sendStatus("CONNECTING")
      updateNotification("CHEMCHEM TV KENYA • VIDEO + AUDIO • CONNECTING")
      newStream.startStream(endpoint)
    } catch (e: Exception) {
      starting = false
      sendStatus("ERROR: " + (e.message ?: "encoder failed"))
      stopEncoder()
      stopSelf()
    }
  }

  private fun updateNotification(text: String) {
    getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification(text))
  }

  private fun stopEncoder() {
    starting = false
    try { stream?.stopStream() } catch (_: Exception) {}
    try { stream?.release() } catch (_: Exception) {}
    stream = null
    try { mediaProjection?.unregisterCallback(projectionCallback) } catch (_: Exception) {}
    try { mediaProjection?.stop() } catch (_: Exception) {}
    mediaProjection = null
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
      this, 1, Intent(this, EncoderService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val openPending = PendingIntent.getActivity(
      this, 2, Intent(this, MainActivity::class.java),
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
  override fun onConnectionStarted(url: String) { sendStatus("CONNECTING") }
  override fun onConnectionSuccess() { starting = false; sendStatus("LIVE"); updateNotification("CHEMCHEM TV KENYA • LIVE • VIDEO + AUDIO") }
  override fun onNewBitrate(bitrate: Long) { sendStatus("LIVE • " + (bitrate / 1000) + " kbps") }
  override fun onConnectionFailed(reason: String) { starting = false; sendStatus("ERROR: " + reason); updateNotification("CHEMCHEM TV KENYA • FACEBOOK ERROR") }
  override fun onDisconnect() { starting = false; sendStatus("DISCONNECTED"); updateNotification("CHEMCHEM TV KENYA • DISCONNECTED") }
  override fun onAuthError() { starting = false; sendStatus("FACEBOOK KEY REJECTED") }
  override fun onAuthSuccess() = Unit

  override fun onDestroy() {
    stopEncoder()
    super.onDestroy()
  }
}
