const jwt = require('jsonwebtoken');
const { User } = require('../models');

const connectedUsers = new Map(); // userId -> socketId

const socketHandler = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (!user || !user.active) {
        return next(new Error('User not found'));
      }
      
      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    
    console.log(`📱 User connected: ${userId}`);
    
    // Store connection
    connectedUsers.set(userId, socket.id);
    
    // Join personal room
    socket.join(`user:${userId}`);
    
    // Update user online status
    await User.findByIdAndUpdate(userId, {
      isOnline: true,
      lastActive: new Date(),
    });
    
    // Broadcast online status to matches
    broadcastOnlineStatus(io, userId, true);
    
    // Handle typing indicator
    socket.on('typing', async (data) => {
      const { matchId, isTyping } = data;
      
      // Emit to the other user in the match
      socket.to(`match:${matchId}`).emit('typing', {
        matchId,
        userId,
        isTyping,
      });
    });
    
    // Join match rooms for real-time chat
    socket.on('join_match', (matchId) => {
      socket.join(`match:${matchId}`);
      console.log(`User ${userId} joined match room: ${matchId}`);
    });
    
    socket.on('leave_match', (matchId) => {
      socket.leave(`match:${matchId}`);
      console.log(`User ${userId} left match room: ${matchId}`);
    });
    
    // Handle message sent (real-time delivery)
    socket.on('send_message', async (data) => {
      const { matchId, content, type = 'text', mediaUrl } = data;
      
      // Emit to match room (both users)
      io.to(`match:${matchId}`).emit('message_sent', {
        matchId,
        senderId: userId,
        content,
        type,
        mediaUrl,
        timestamp: new Date(),
      });
    });
    
    // Handle message read
    socket.on('messages_read', async (data) => {
      const { matchId, messageIds } = data;
      
      socket.to(`match:${matchId}`).emit('messages_read', {
        matchId,
        messageIds,
        readAt: new Date(),
      });
    });
    
    // Handle message like
    socket.on('message_liked', async (data) => {
      const { matchId, messageId, liked } = data;
      
      socket.to(`match:${matchId}`).emit('message_liked', {
        matchId,
        messageId,
        liked,
        likedAt: new Date(),
      });
    });

    // ── Video Call Signaling ──────────────────────────────────────────
    // Call initiation is also done via REST POST /api/v1/calls/initiate
    // These socket events handle call state during the call

    socket.on('call_answer', (data) => {
      // data: { callId, matchId, accepted }
      const { callId, matchId, accepted } = data;
      socket.to(`match:${matchId}`).emit('call_answered', { callId, accepted });
    });

    socket.on('call_end', (data) => {
      // data: { callId, matchId }
      const { callId, matchId } = data;
      socket.to(`match:${matchId}`).emit('call_ended', { callId, endedBy: userId });
    });

    socket.on('call_rejected', (data) => {
      const { callId, matchId } = data;
      socket.to(`match:${matchId}`).emit('call_rejected', { callId, rejectedBy: userId });
    });
    
    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`📴 User disconnected: ${userId}`);
      
      // Remove from connected users
      connectedUsers.delete(userId);
      
      // Update user offline status
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastActive: new Date(),
      });
      
      // Broadcast offline status
      broadcastOnlineStatus(io, userId, false);
    });
    
    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${userId}:`, error);
    });
  });
};

// Broadcast online status to all matches
const broadcastOnlineStatus = async (io, userId, isOnline) => {
  const { Match } = require('../models');
  
  try {
    const matches = await Match.find({
      users: userId,
      unmatched: false,
    });
    
    for (const match of matches) {
      const otherUserId = match.users.find(
        u => u.toString() !== userId
      );
      
      if (otherUserId && connectedUsers.has(otherUserId.toString())) {
        io.to(`user:${otherUserId}`).emit('user_status', {
          userId,
          isOnline,
          lastActive: new Date(),
        });
      }
    }
  } catch (error) {
    console.error('Error broadcasting online status:', error);
  }
};

// Export for use in routes
module.exports = socketHandler;
module.exports.connectedUsers = connectedUsers;
