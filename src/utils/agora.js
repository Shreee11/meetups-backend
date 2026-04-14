/**
 * Agora RTC Token Generator
 * Set AGORA_APP_ID and AGORA_APP_CERTIFICATE in .env
 *
 * Uses the `agora-access-token` package to generate RTC tokens.
 * In development, returns a mock token if credentials are not set.
 */

const generateAgoraToken = (channelName, uid, role = 'publisher', expirationSecs = 3600) => {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCertificate) {
    console.log(`📹 [AGORA-DEV] Token for channel: ${channelName}, uid: ${uid}`);
    return `dev-agora-token-${channelName}-${uid}`;
  }

  try {
    const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationSecs;
    const rtcRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    return RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      rtcRole,
      privilegeExpiredTs
    );
  } catch (err) {
    console.error('Agora token generation failed:', err.message);
    return null;
  }
};

module.exports = { generateAgoraToken };
