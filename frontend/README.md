# ProfRate 🎓
### University Professor Rating Platform

A full-stack web application for students to find, explore, and rate their university professors.

---

## Tech Stack

| Layer    | Technology                  |
|----------|-----------------------------|
| Frontend | HTML · CSS · Vanilla JS     |
| Backend  | Node.js · Express.js        |
| Database | MySQL                       |

---

## Project Structure

```
profrate/
├── backend/
│   ├── server.js          # Express API server
│   └── package.json
└── frontend/
    ├── index.html         # Homepage (hero + search + top-rated)
    ├── search.html        # Search results / all professors
    ├── professor.html     # Professor profile + reviews
    ├── subject.html       # Subject page + professors teaching it
    ├── admin.html         # Admin panel
    ├── css/
    │   └── styles.css     # Full stylesheet
    └── js/
        └── shared.js      # API layer + utilities
```

---

## Prerequisites

- **Node.js** v16+
- **MySQL** 5.7+ or 8+
- A modern web browser

---

## Quick Start

### 1. Set Up MySQL

Make sure MySQL is running. The app will automatically:
- Create the `profrate` database
- Create all required tables
- Seed demo data (8 professors, 15 subjects, reviews)

> No manual SQL needed!

### 2. Configure Database (Optional)

Edit `backend/server.js` lines 7–13 OR set environment variables:

```bash
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=yourpassword
export DB_NAME=profrate
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
```

### 4. Start the API Server

```bash
node server.js
# or for development with auto-restart:
npm install -g nodemon
nodemon server.js
```

The API will start at **http://localhost:3001**

### 5. Open the Frontend

Open `frontend/index.html` directly in your browser, or serve it:

```bash
# Using Python (in the frontend/ directory)
cd frontend
python3 -m http.server 8080
# Open http://localhost:8080
```

---

## API Endpoints

### Professors
| Method | Endpoint                    | Description                    |
|--------|-----------------------------|--------------------------------|
| GET    | /api/professors             | All professors with ratings    |
| GET    | /api/professors/top         | Top-rated professors (max 6)   |
| GET    | /api/professors/recent      | Recently added (max 6)         |
| GET    | /api/professors/:id         | Single professor + reviews     |
| POST   | /api/professors             | Add new professor              |
| DELETE | /api/professors/:id         | Delete professor               |

### Subjects
| Method | Endpoint        | Description                         |
|--------|-----------------|-------------------------------------|
| GET    | /api/subjects   | All subjects with professor count   |
| GET    | /api/subjects/:id| Subject + professors teaching it   |
| POST   | /api/subjects   | Add new subject                     |
| DELETE | /api/subjects/:id| Delete subject                     |

### Reviews
| Method | Endpoint                  | Description              |
|--------|---------------------------|--------------------------|
| GET    | /api/reviews/:professorId | All reviews for prof     |
| POST   | /api/reviews              | Submit a review          |

### Search
| Method | Endpoint              | Description                    |
|--------|-----------------------|--------------------------------|
| GET    | /api/search?query=    | Search professors + subjects   |

### Assignments
| Method | Endpoint                  | Description                  |
|--------|---------------------------|------------------------------|
| POST   | /api/professor-subjects   | Assign subject to professor  |

---

## Database Schema

```sql
professors       — id, full_name, university, faculty, department, biography, created_at
subjects         — id, subject_name, department
professor_subjects — id, professor_id, subject_id  (many-to-many)
reviews          — id, professor_id, rating(1-5), comment, created_at
```

---

## Features

- 🔍 **Live search** with dropdown (professors + subjects)
- 👤 **Professor profiles** with biography, subjects, star ratings
- 📚 **Subject pages** listing all professors who teach it
- ⭐ **Review system** — submit 1–5 star ratings with comments
- ⚙️ **Admin panel** — add/delete professors and subjects, assign subjects
- 📊 **Stats bar** — live counts of professors, subjects, reviews, departments
- 📱 **Mobile responsive** design
- 🌙 **Dark theme** throughout
- 🎨 **Modern UI** with DM Serif Display + DM Sans typography

---

## Demo Data

On first run, the app seeds:
- **8 professors** across Engineering, Sciences, Humanities, Medicine, Economics
- **15 subjects** spanning CS, Math, Philosophy, Biochemistry, Physics, Finance
- **30–40 reviews** with realistic comments and ratings

---

## Customization

### Change the API URL
In `frontend/js/shared.js`, line 3:
```js
const API = 'http://localhost:3001/api';
```

### Change the Port
In `backend/server.js`, line 5:
```js
const PORT = process.env.PORT || 3001;
```

---

## Screenshots

| Page | Description |
|------|-------------|
| **Homepage** | Hero + live search + top-rated cards |
| **Search** | Results grid with tabs (professors/subjects) |
| **Professor Profile** | Full bio, ratings, subjects, reviews |
| **Subject Page** | All professors teaching the subject |
| **Admin Panel** | Forms to manage all data |
