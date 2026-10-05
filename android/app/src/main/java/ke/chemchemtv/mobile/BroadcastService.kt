package ke.chemchemtv.mobile

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.ServiceCompat
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.sources.audio.MicrophoneSource
import com.pedro.encoder.input.sources.video.NoVideoSource
import com.pedro.encoder.input.sources.video.ScreenSource
import com.pedro.library.generic.GenericStream

class BroadcastService : Service(), ConnectChecker {
  companion object {
    const val ACTION_STATUS = "ke.chemchemtv.mobile.BROADCAST_STATUS"
    const val ACTION_STOP = "ke.chemchemtv.mobile.STOP_BROADCAST"
    const val EXTRA_STATUS = "status"
    const val EXTRA_DETAIL = "detail"
    const val EXTRA_PROJECTION = "projection"
    const val EXTRA_PROJECTION_RESULT = "projection_result"
    const val EXTRA_ENDPOINT = "endpoint"
    private const val CHANNEL = "chemchem_broadcast"
    private const val NOTIFICATION_ID = 2255
  }

  private var stream: GenericStream? = null
  private var projection: MediaProjection? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    if (Build.VERSION.SDK_INT >= 26) {
      val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
      nm.createNotificationChannel(NotificationChannel(CHANNEL,"CHEMCHEM TV Broadcast",NotificationManager.IMPORTANCE_LOW))
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopStreaming()
      return START_NOT_STICKY
    }

    val endpoint = intent?.getStringExtra(EXTRA_ENDPOINT).orEmpty()
    val projectionIntent = if (Build.VERSION.SDK_INT >= 33) {
      intent?.getParcelableExtra(EXTRA_PROJECTION,Intent::class.java)
    } else {
      @Suppress("DEPRECATION") intent?.getParcelableExtra<Intent>(EXTRA_PROJECTION)
    }
    val resultCode = intent?.getIntExtra(EXTRA_PROJECTION_RESULT,-1) ?: -1

    if (endpoint.isBlank() || projectionIntent == null || resultCode == -1) {
      sendStatus("ERROR","Missing Facebook RTMPS endpoint or screen-capture permission.")
      stopSelf()
      return START_NOT_STICKY
    }

    try {
      val notification = buildNotification()
      if (Build.VERSION.SDK_INT >= 29) {
        ServiceCompat.startForeground(
          this,NOTIFICATION_ID,notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        )
      } else {
        startForeground(NOTIFICATION_ID,notification)
      }

      val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      projection = manager.getMediaProjection(resultCode,projectionIntent)
        ?: throw IllegalStateException("Android did not grant MediaProjection")

      val screenSource = ScreenSource(applicationContext,projection!!)
      val newStream = GenericStream(applicationContext,this,NoVideoSource(),MicrophoneSource())
      newStream.getGlInterface().setCameraOrientation(0)
      newStream.getGlInterface().setForceRender(true,30)

      val videoReady = newStream.prepareVideo(1280,720,3500 * 1000,rotation = 0)
      val audioReady = newStream.prepareAudio(44100,true,128 * 1000,echoCanceler = true,noiseSuppressor = true)
      if (!videoReady || !audioReady) {
        newStream.release()
        throw IllegalStateException("H.264/AAC encoder preparation failed on this device")
      }

      newStream.changeVideoSource(screenSource)
      stream?.release()
      stream = newStream
      sendStatus("ENCODER_READY","Program screen active • H.264 720p30 + AAC 128kbps")
      newStream.startStream(endpoint)
    } catch (e: Exception) {
      Log.e("CHEMCHEM_BROADCAST","Broadcast start failed",e)
      sendStatus("ERROR",e.message ?: "Broadcast engine failed")
      stopStreaming()
    }
    return START_NOT_STICKY
  }

  private fun sendStatus(state:String,detail:String) {
    sendBroadcast(Intent(ACTION_STATUS).setPackage(packageName)
      .putExtra(EXTRA_STATUS,state).putExtra(EXTRA_DETAIL,detail))
  }

  private fun buildNotification():Notification {
    val stopIntent = Intent(this,BroadcastService::class.java).setAction(ACTION_STOP)
    val pending = PendingIntent.getService(this,2256,stopIntent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    return if (Build.VERSION.SDK_INT >= 26) {
      Notification.Builder(this,CHANNEL)
        .setContentTitle("CHEMCHEM TV KENYA")
        .setContentText("LIVE — Facebook program encoder is running")
        .setSmallIcon(android.R.drawable.ic_media_play)
        .setOngoing(true)
        .addAction(Notification.Action.Builder(null,"STOP LIVE",pending).build())
        .build()
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
        .setContentTitle("CHEMCHEM TV KENYA")
        .setContentText("LIVE — Facebook program encoder is running")
        .setSmallIcon(android.R.drawable.ic_media_play)
        .setOngoing(true)
        .build()
    }
  }

  private fun stopStreaming() {
    try {
      stream?.let { if (it.isStreaming) it.stopStream(); it.release() }
    } catch (_:Exception) {}
    stream = null
    try { projection?.stop() } catch (_:Exception) {}
    projection = null
    stopForeground(true)
    sendStatus("STOPPED","Facebook connection closed and encoder released.")
    stopSelf()
  }

  override fun onDestroy() {
    stopStreaming()
    super.onDestroy()
  }

  override fun onConnectionStarted(url:String) = sendStatus("CONNECTING","Facebook RTMPS handshake started.")
  override fun onConnectionSuccess() = sendStatus("LIVE","Facebook accepted RTMPS. Video and audio packets are being sent.")
  override fun onNewBitrate(bitrate:Long) = sendStatus("LIVE","Facebook delivery: " + (bitrate / 1000) + " kbps")
  override fun onConnectionFailed(reason:String) { sendStatus("ERROR","RTMP ERROR: " + reason); stopStreaming() }
  override fun onDisconnect() { sendStatus("STOPPED","Facebook closed the RTMPS connection."); stopStreaming() }
  override fun onAuthError() { sendStatus("ERROR","Facebook rejected the stream credentials."); stopStreaming() }
  override fun onAuthSuccess() = Unit
}