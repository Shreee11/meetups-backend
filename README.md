# Tender Backend

Backend API for the Tender dating application.

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.io
- **Authentication**: JWT
- **Image Storage**: Cloudinary
- **SMS**: Twilio

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Cloudinary account
- Twilio account (for SMS)

### Installation

1. Clone the repository
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```

5. Update `.env` with your configuration

6. Start the development server:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/v1/auth/send-code` - Send verification code
- `POST /api/v1/auth/verify-code` - Verify code
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout

### Users
- `GET /api/v1/users/me` - Get current user
- `PATCH /api/v1/users/me` - Update profile
- `PATCH /api/v1/users/me/location` - Update location
- `PATCH /api/v1/users/me/preferences` - Update preferences
- `POST /api/v1/users/me/photos` - Upload photo
- `DELETE /api/v1/users/me/photos/:photoId` - Delete photo
- `PATCH /api/v1/users/me/photos/reorder` - Reorder photos
- `GET /api/v1/users/:userId` - Get user profile
- `POST /api/v1/users/:userId/block` - Block user
- `DELETE /api/v1/users/:userId/block` - Unblock user
- `POST /api/v1/users/:userId/report` - Report user
- `DELETE /api/v1/users/me` - Delete account

### Discovery
- `GET /api/v1/discovery` - Get potential matches
- `POST /api/v1/discovery/swipe` - Swipe on user
- `POST /api/v1/discovery/undo` - Undo last swipe (premium)
- `GET /api/v1/discovery/likes-me` - See who liked you (premium)
- `POST /api/v1/discovery/boost` - Activate boost

### Matches
- `GET /api/v1/matches` - Get all matches
- `GET /api/v1/matches/:matchId` - Get match details
- `DELETE /api/v1/matches/:matchId` - Unmatch

### Messages
- `GET /api/v1/messages/:matchId` - Get messages
- `POST /api/v1/messages/:matchId` - Send message
- `PATCH /api/v1/messages/:messageId/like` - Like message
- `DELETE /api/v1/messages/:messageId` - Delete message
- `POST /api/v1/messages/:matchId/typing` - Typing indicator

### Subscriptions
- `GET /api/v1/subscriptions/plans` - Get plans
- `GET /api/v1/subscriptions/me` - Get current subscription
- `POST /api/v1/subscriptions/subscribe` - Subscribe
- `POST /api/v1/subscriptions/cancel` - Cancel subscription
- `POST /api/v1/subscriptions/restore` - Restore purchases

## Socket.io Events

### Client to Server
- `join_match` - Join a match room for real-time chat
- `leave_match` - Leave a match room
- `typing` - Send typing indicator
- `send_message` - Send a message
- `messages_read` - Mark messages as read
- `message_liked` - Like a message

### Server to Client
- `new_match` - New match notification
- `unmatched` - Unmatch notification
- `new_message` - New message received
- `typing` - Typing indicator
- `messages_read` - Read receipt
- `message_liked` - Message liked notification
- `user_status` - User online/offline status

## Project Structure

```
backend/
├── src/
│   ├── models/          # Mongoose models
│   ├── routes/          # Express routes
│   ├── middleware/      # Custom middleware
│   ├── socket/          # Socket.io handlers
│   ├── utils/           # Utility functions
│   └── server.js        # App entry point
├── .env.example         # Environment template
├── package.json
└── README.md
```

## License

ISC
