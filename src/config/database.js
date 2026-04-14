const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined in environment variables');

  await mongoose.connect(uri, {
    // Connection pool — 10 per Node process; with 4 workers → 40 total
    maxPoolSize: 10,
    minPoolSize: 2,

    // Timeouts
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,

    // Write concern — acknowledged by primary + 1 replica before responding
    w: 'majority',
    wtimeoutMS: 10000,

    // Use the newer connection string parser and unified topology
    retryWrites: true,
    retryReads: true,
  });

  console.log('✅ MongoDB connected');

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB runtime error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected — attempting reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
  });
};

module.exports = connectDB;
