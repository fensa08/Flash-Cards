import { Router, Request, Response } from 'express';
import pool from '../db';
import { AnswerRequest, Card } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

// Get next card using weighted random selection
router.get('/:deckId/next', async (req: Request, res: Response) => {
  const { deckId } = req.params;
  const excludedIds = req.query.excluded 
    ? (req.query.excluded as string).split(',').map(Number).filter(n => !isNaN(n))
    : [];
  
  try {
    // Build query to exclude already-known cards in this session
    let query = 'SELECT * FROM cards WHERE deck_id = ?';
    const params: (string | number)[] = [deckId];
    
    if (excludedIds.length > 0) {
      const placeholders = excludedIds.map(() => '?').join(', ');
      query += ` AND id NOT IN (${placeholders})`;
      params.push(...excludedIds);
    }
    
    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    const cards = rows as Card[];
    
    if (cards.length === 0) {
      res.json({ card: null, remaining: 0 });
      return;
    }
    
    // Weighted random selection
    const totalWeight = cards.reduce((sum, card) => sum + card.weight, 0);
    let random = Math.random() * totalWeight;
    
    let selectedCard: Card | null = null;
    for (const card of cards) {
      random -= card.weight;
      if (random <= 0) {
        selectedCard = card;
        break;
      }
    }
    
    // Fallback to first card if somehow none selected
    if (!selectedCard) {
      selectedCard = cards[0];
    }
    
    res.json({ 
      card: selectedCard, 
      remaining: cards.length 
    });
  } catch (error) {
    console.error('Error fetching next card:', error);
    res.status(500).json({ error: 'Failed to fetch next card' });
  }
});

// Submit answer and update card weight
router.post('/:deckId/answer', async (req: Request<{ deckId: string }, {}, AnswerRequest>, res: Response) => {
  const { card_id, response } = req.body;
  
  if (!card_id) {
    res.status(400).json({ error: 'Card ID is required' });
    return;
  }
  
  if (!response || !['know', 'uncertain', 'dont_know'].includes(response)) {
    res.status(400).json({ error: 'Valid response is required (know, uncertain, dont_know)' });
    return;
  }
  
  try {
    // Calculate weight adjustment based on response
    let weightChange = 0;
    switch (response) {
      case 'know':
        // No weight change - card will be excluded from session
        weightChange = 0;
        break;
      case 'uncertain':
        // Slight increase in frequency
        weightChange = 1;
        break;
      case 'dont_know':
        // Significant increase in frequency
        weightChange = 3;
        break;
    }
    
    // Update card weight and times_seen
    await pool.execute<ResultSetHeader>(
      'UPDATE cards SET weight = weight + ?, times_seen = times_seen + 1 WHERE id = ?',
      [weightChange, card_id]
    );
    
    // Fetch updated card
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM cards WHERE id = ?',
      [card_id]
    );
    
    if (rows.length === 0) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    
    res.json({ 
      card: rows[0] as Card,
      exclude: response === 'know' // Tell frontend to exclude this card
    });
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

// Reset all card weights in a deck
router.post('/:deckId/reset', async (req: Request, res: Response) => {
  const { deckId } = req.params;
  
  try {
    await pool.execute<ResultSetHeader>(
      'UPDATE cards SET weight = 1 WHERE deck_id = ?',
      [deckId]
    );
    
    res.json({ message: 'Deck weights reset successfully' });
  } catch (error) {
    console.error('Error resetting deck:', error);
    res.status(500).json({ error: 'Failed to reset deck' });
  }
});

export default router;

