# Flash Cards Memorization App

A modern flash cards application with spaced repetition for effective memorization.

## Features

- **Multiple Decks**: Organize your cards into different topic decks
- **Bulk Import**: Paste multiple questions at once (one per line)
- **Spaced Repetition**: Cards you don't know appear more frequently
- **Progress Tracking**: Track your learning session performance

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: MySQL

## Prerequisites

- Node.js 16+ (18+ recommended)
- MySQL server running locally
- A MySQL database named `flashcards`

## Setup

### Database Setup

1. Start your MySQL server
2. Create the database:
   ```sql
   CREATE DATABASE flashcards;
   ```

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

The backend will run on http://localhost:3001

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on http://localhost:5173

## Environment Variables (Backend)

You can configure the database connection using environment variables:

- `DB_HOST` - MySQL host (default: localhost)
- `DB_USER` - MySQL user (default: root)
- `DB_PASSWORD` - MySQL password (default: empty)
- `DB_NAME` - Database name (default: flashcards)
- `PORT` - Server port (default: 3001)

Example:
```bash
DB_USER=myuser DB_PASSWORD=mypass npm run dev
```

## How It Works

### Study Session

1. Select a deck to study
2. For each card, choose one of three responses:
   - **I Know**: Card is removed from the current session
   - **Not Sure**: Card weight increases by 1 (slightly more frequent)
   - **Don't Know**: Card weight increases by 3 (much more frequent)

3. Cards with higher weights are more likely to appear in future study sessions

### Bulk Import

1. Click "Manage" on any deck
2. Paste your questions (one per line) in the text area
3. Click "Import Cards"

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/decks | List all decks |
| POST | /api/decks | Create new deck |
| DELETE | /api/decks/:id | Delete deck |
| GET | /api/decks/:id/cards | Get cards in deck |
| POST | /api/cards/bulk | Bulk import cards |
| GET | /api/study/:deckId/next | Get next card (weighted) |
| POST | /api/study/:deckId/answer | Submit answer |
| POST | /api/study/:deckId/reset | Reset card weights |

