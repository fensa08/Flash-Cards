import { Router, Request, Response } from 'express';
import pool from '../db';
import { BulkImportRequest, Card } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

// Bulk import cards
router.post('/bulk', async (req: Request<{}, {}, BulkImportRequest>, res: Response) => {
  const { deck_id, questions } = req.body;
  
  if (!deck_id) {
    res.status(400).json({ error: 'Deck ID is required' });
    return;
  }
  
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ error: 'Questions array is required' });
    return;
  }
  
  // Filter out empty questions
  const validQuestions = questions
    .map(q => q.trim())
    .filter(q => q.length > 0);
  
  if (validQuestions.length === 0) {
    res.status(400).json({ error: 'No valid questions provided' });
    return;
  }
  
  try {
    // Verify deck exists
    const [deckRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM decks WHERE id = ?',
      [deck_id]
    );
    
    if (deckRows.length === 0) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }
    
    // Insert all questions
    const placeholders = validQuestions.map(() => '(?, ?)').join(', ');
    const values = validQuestions.flatMap(q => [deck_id, q]);
    
    await pool.execute(
      `INSERT INTO cards (deck_id, question) VALUES ${placeholders}`,
      values
    );
    
    res.status(201).json({ 
      message: `Successfully imported ${validQuestions.length} cards`,
      count: validQuestions.length
    });
  } catch (error) {
    console.error('Error importing cards:', error);
    res.status(500).json({ error: 'Failed to import cards' });
  }
});

// Get single card
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM cards WHERE id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    
    res.json(rows[0] as Card);
  } catch (error) {
    console.error('Error fetching card:', error);
    res.status(500).json({ error: 'Failed to fetch card' });
  }
});

// Delete card
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM cards WHERE id = ?',
      [req.params.id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    
    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

export default router;

