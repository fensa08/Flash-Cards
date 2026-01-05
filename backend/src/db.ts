import mysql from 'mysql2/promise';

// Database connection status tracking
export interface DbStatus {
  connected: boolean;
  error: string | null;
  lastChecked: Date;
}

let dbStatus: DbStatus = {
  connected: false,
  error: null,
  lastChecked: new Date()
};

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'flashcards',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export function getDbStatus(): DbStatus {
  return { ...dbStatus };
}

export async function checkDatabaseConnection(): Promise<DbStatus> {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    
    dbStatus = {
      connected: true,
      error: null,
      lastChecked: new Date()
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    
    // Parse common MySQL errors for user-friendly messages
    let friendlyError = errorMessage;
    if (errorMessage.includes('ECONNREFUSED')) {
      friendlyError = 'Cannot connect to MySQL server. Please ensure MySQL is running on port 3306';
    } else if (errorMessage.includes('Access denied')) {
      friendlyError = 'Database access denied. Please check your DB_USER and DB_PASSWORD in .env';
    } else if (errorMessage.includes('Unknown database')) {
      friendlyError = `Database '${process.env.DB_NAME || 'flashcards'}' does not exist. Please create it with: mysql -u root -e "CREATE DATABASE flashcards;"`;
    }
    
    dbStatus = {
      connected: false,
      error: friendlyError,
      lastChecked: new Date()
    };
  }
  
  return { ...dbStatus };
}

export async function initializeDatabase(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    
    try {
      // Create decks table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS decks (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create cards table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS cards (
          id INT AUTO_INCREMENT PRIMARY KEY,
          deck_id INT NOT NULL,
          question TEXT NOT NULL,
          weight INT DEFAULT 1,
          times_seen INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
        )
      `);

      console.log('✓ Database tables initialized successfully');
      
      dbStatus = {
        connected: true,
        error: null,
        lastChecked: new Date()
      };
      
      return true;
    } finally {
      connection.release();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    
    // Parse common MySQL errors for user-friendly messages
    let friendlyError = errorMessage;
    if (errorMessage.includes('ECONNREFUSED')) {
      friendlyError = 'Cannot connect to MySQL server. Please ensure MySQL is running on port 3306';
    } else if (errorMessage.includes('Access denied')) {
      friendlyError = 'Database access denied. Please check your DB_USER and DB_PASSWORD in .env';
    } else if (errorMessage.includes('Unknown database')) {
      friendlyError = `Database '${process.env.DB_NAME || 'flashcards'}' does not exist. Please create it with: mysql -u root -e "CREATE DATABASE flashcards;"`;
    }
    
    console.error('✗ Database connection failed:', friendlyError);
    
    dbStatus = {
      connected: false,
      error: friendlyError,
      lastChecked: new Date()
    };
    
    return false;
  }
}

export default pool;

