import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initializeDatabase, getDbStatus, checkDatabaseConnection } from './db';
import decksRouter from './routes/decks';
import cardsRouter from './routes/cards';
import studyRouter from './routes/study';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint with detailed status
app.get('/api/health', async (_, res) => {
  const dbStatus = getDbStatus();
  
  const health = {
    status: dbStatus.connected ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      server: {
        status: 'running',
        port: PORT
      },
      database: {
        status: dbStatus.connected ? 'connected' : 'disconnected',
        error: dbStatus.error,
        lastChecked: dbStatus.lastChecked.toISOString()
      }
    }
  };
  
  // Return 503 if database is not connected
  const statusCode = dbStatus.connected ? 200 : 503;
  res.status(statusCode).json(health);
});

// Endpoint to manually check database connection
app.get('/api/health/db', async (_, res) => {
  const dbStatus = await checkDatabaseConnection();
  
  if (dbStatus.connected) {
    res.json({
      status: 'connected',
      message: 'Database connection is healthy',
      lastChecked: dbStatus.lastChecked.toISOString()
    });
  } else {
    res.status(503).json({
      status: 'disconnected',
      error: dbStatus.error,
      lastChecked: dbStatus.lastChecked.toISOString()
    });
  }
});

// Routes
app.use('/api/decks', decksRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/study', studyRouter);

// Initialize database and start server
async function start() {
  // Start the server regardless of database status
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
  });
  
  // Try to initialize database (but don't fail if it doesn't work)
  const dbConnected = await initializeDatabase();
  
  if (!dbConnected) {
    console.log('\n⚠️  Server is running but database is not connected.');
    console.log('   API endpoints that require database will return errors.');
    console.log('   Fix the database connection and the server will auto-reconnect.\n');
  }
}

start();

