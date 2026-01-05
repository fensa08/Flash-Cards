import { Router, Request, Response } from 'express';
import pool from '../db';
import { Deck, CreateDeckRequest } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

// Get all decks with card counts
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(`
      SELECT d.*, COUNT(c.id) as card_count 
      FROM decks d 
      LEFT JOIN cards c ON d.id = c.deck_id 
      GROUP BY d.id 
      ORDER BY d.created_at DESC
    `);
    res.json(rows as Deck[]);
  } catch (error) {
    console.error('Error fetching decks:', error);
    res.status(500).json({ error: 'Failed to fetch decks' });
  }
});

// Get single deck
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT d.*, COUNT(c.id) as card_count 
       FROM decks d 
       LEFT JOIN cards c ON d.id = c.deck_id 
       WHERE d.id = ? 
       GROUP BY d.id`,
      [req.params.id]
    );
    
    if (rows.length === 0) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }
    
    res.json(rows[0] as Deck);
  } catch (error) {
    console.error('Error fetching deck:', error);
    res.status(500).json({ error: 'Failed to fetch deck' });
  }
});

// Create new deck
router.post('/', async (req: Request<{}, {}, CreateDeckRequest>, res: Response) => {
  const { name } = req.body;
  
  if (!name || name.trim() === '') {
    res.status(400).json({ error: 'Deck name is required' });
    return;
  }
  
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO decks (name) VALUES (?)',
      [name.trim()]
    );
    
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM decks WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(rows[0] as Deck);
  } catch (error) {
    console.error('Error creating deck:', error);
    res.status(500).json({ error: 'Failed to create deck' });
  }
});

// Delete deck
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM decks WHERE id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }
    
    res.json({ message: 'Deck deleted successfully' });
  } catch (error) {
    console.error('Error deleting deck:', error);
    res.status(500).json({ error: 'Failed to delete deck' });
  }
});

// Get cards in a deck
router.get('/:id/cards', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM cards WHERE deck_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

export default router;

