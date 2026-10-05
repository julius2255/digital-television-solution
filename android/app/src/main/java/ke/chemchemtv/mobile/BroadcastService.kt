package ke.chemchemtv.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.ServiceCompat
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.sources.audio.MicrophoneSource
import com.pedro.encoder.input.sources.video.NoVideoSource
import com.pedro.encoder.input.sources.video.ScreenSource
import com.pedro.library.rtmp.RtmpStream

class BroadcastService : Service(), ConnectChecker {
  companion object {
    const val ACTION_STATUS = "ke.chemchemtv.mobile.BROADCAST_STATUS"
    const val EXTRA_STATUS = "status"
    const val EXTRA_DETAIL = "detail"
    const val EXTRA_PROJECTION = "projection"
    const val EXTRA_ENDPOINT = "endpoint"
    private const val CHANNEL = "chemchem_broadcast"
    private const val NOTIFICATION_ID = 2255
  }

  private var stream: RtmpStream? = null
  private var projection: android.media.projection.MediaProjection? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent == null) return START_NOT_STICKY
    val endpoint = intent.getStringExtra(EXTRA_ENDPOINT).orEmpty()
    val projectionIntent = if (Build.VERSION.SDK_INT >= 33) {
      intent.getParcelableExtra(EXTRA_PROJECTION, Intent::class.java)
    } else {
      @Suppress("DEPRECATION") intent.getParcelableExtra<Intent>(EXTRA_PROJECTION)
    }
    if (endpoint.isBlank() || projectionIntent == null) {
      sendStatus("ERROR", "Missing RTMPS endpoint or screen permission")
      stopSelf()
      return START_NOT_STICKY
    }

    createNotificationChannel()
    val notification = buildNotification("CHEMCHEM TV KENYA is broadcasting")
    if (Build.VERSION.SDK_INT >= 29) {
      ServiceCompat.startForeground(this, NOTIFICATION_ID, notification,
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION or android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }

    try {
      val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      projection = manager.getMediaProjection(
        intent.getIntExtra("projection_result", -1),
        projectionIntent
      ) ?: throw IllegalStateException("Android did not grant MediaProjection")

      val screenSource = ScreenSource(applicationContext, projection!!)
      stream = RtmpStream(this, this, NoVideoSource(), MicrophoneSource())
      stream!!.getGlInterface().setForceRender(true, 30)
      val videoOk = stream!!.prepareVideo(1280, 720, 3500 * 1000, 30)
      val audioOk = stream!!.prepareAudio(44100, true, 128 * 1000)
      if (!videoOk || !audioOk) throw IllegalStateException("H.264/AAC encoder preparation failed")
      stream!!.changeVideoSource(screenSource)
      sendStatus("ENCODER_READY", "Program screen capture active • H.264 720p30 + AAC")
      stream!!.startStream(endpoint)
    } catch (e: Exception) {
      Log.e("CHEMCHEM_BROADCAST", "Broadcast start failed", e)
      sendStatus("ERROR", e.message ?: "Broadcast engine failed")
      stopStreaming()
    }
    return START_STICKY
  }

  private fun sendStatus(status: String, detail: String) {
    sendBroadcast(Intent(ACTION_STATUS).putExtra(EXTRA_STATUS, status).putExtra(EXTRA_DETAIL, detail))
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= 26) {
      val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
      nm.createNotificationChannel(NotificationChannel(CHANNEL, "CHEMCHEM Broadcast", NotificationManager.IMPORTANCE_LOW))
    }
  }

  private fun buildNotification(text: String): Notification =
    if (Build.VERSION.SDK_INT >= 26) {
      Notification.Builder(this, CHANNEL).setContentTitle("CHEMCHEM TV KENYA").setContentText(text)
        .setSmallIcon(android.R.drawable.ic_media_play).setOngoing(true).build()
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this).setContentTitle("CHEMCHEM TV KENYA").setContentText(text)
        .setSmallIcon(android.R.drawable.ic_media_play).setOngoing(true).build()
    }

  private fun stopStreaming() {
    stream?.let { if (it.isStreaming) it.stopStream(); it.release() }
    stream = null
    projection?.stop()
    projection = null
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    stopStreaming()
    super.onDestroy()
  }

  override fun onConnectionStarted(url: String) = sendStatus("CONNECTING", "Facebook RTMPS handshake started")
  override fun onConnectionSuccess() = sendStatus("LIVE", "Facebook accepted the connection; program video is being sent")
  override fun onNewBitrate(bitrate: Long) = sendStatus("LIVE", "Facebook delivery: ${bitrate / 1000} kbps")
  override fun onConnectionFailed(reason: String) { sendStatus("ERROR", "RTMP ERROR: $reason"); stopStreaming() }
  override fun onDisconnect() { sendStatus("STOPPED", "Facebook connection closed"); stopStreaming() }
  override fun onAuthError() { sendStatus("ERROR", "Facebook rejected the stream credentials"); stopStreaming() }
  override fun onAuthSuccess() {}
}
