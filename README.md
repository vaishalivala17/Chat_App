# 💬 PULSE — Real-time Chat App

A full-stack real-time chat application built with **React**, **Node.js**, **Socket.IO**, **MongoDB**, and **JWT** authentication.

---
## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 18
- **MongoDB** running locally (`mongod`) OR a MongoDB Atlas connection string

---

### 1. Clone / extract the project

```bash
cd chat-app
```

---

### 2. Set up the Server

```bash
cd server

# Install dependencies
npm install

# Create your .env file
cp .env.example .env
# Edit .env with your values (see below)

# Start development server
npm run dev
```

**`.env` values:**
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/chatapp
JWT_SECRET=change_this_to_a_long_random_string
CLIENT_URL=http://localhost:5173
```

> 💡 For MongoDB Atlas: replace MONGO_URI with your Atlas connection string.

---

### 3. Set up the Client

```bash
# From project root
cd client

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Register / Login** | JWT-based auth, bcrypt password hashing |
| **Real-time messaging** | Socket.IO bidirectional events |
| **Typing indicators** | Live "typing…" display with debounce |
| **Online status** | Green dot when user is connected |
| **Read receipts** | ✓ (sent) / ✓✓ cyan (read) |
| **Conversation list** | Sorted by last message + unread count badge |
| **User search** | Real-time search by username |
| **Message history** | Paginated fetch from MongoDB |
| **Optimistic UI** | Messages appear instantly before server confirm |
| **Date groups** | Messages grouped by Today / Yesterday / date |
| **Mobile responsive** | Sidebar drawer on mobile |
| **Persistent storage** | All messages stored in MongoDB |

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| GET  | `/api/auth/me` | Get current user |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/messages/:userId` | Get conversation |
| DELETE | `/api/messages/:messageId` | Soft delete |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/search?q=name` | Search users |
| GET | `/api/users/conversations` | List conversations |
| GET | `/api/users/:id` | Get user by ID |

---

## 📡 Socket.IO Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `message:send` | `{ receiverId, content }` | Send a message |
| `typing:start` | `{ receiverId }` | User started typing |
| `typing:stop`  | `{ receiverId }` | User stopped typing |
| `message:read` | `{ senderId, room }` | Mark messages read |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `message:receive` | Message object | New incoming message |
| `message:sent`    | Message object | Sent confirmation |
| `users:online`    | `string[]` | Updated online user IDs |
| `typing:start`    | `{ userId, username }` | Someone is typing |
| `typing:stop`     | `{ userId }` | Someone stopped typing |
| `message:read`    | `{ readBy, room }` | Messages were read |

---

## 🔒 Security Notes

- Passwords are hashed with **bcrypt** (12 salt rounds)
- JWT tokens expire in **7 days**
- Socket connections require a valid JWT in `handshake.auth.token`
- Protect routes use the `authMiddleware` to verify tokens
- ⚠️ For production: use HTTPS, rotate JWT secret, enable rate limiting

---

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Socket.IO Client, React Router v6, date-fns
- **Backend**: Node.js, Express.js, Socket.IO, Mongoose, bcryptjs, jsonwebtoken
- **Database**: MongoDB
- **Auth**: JWT (JSON Web Tokens)
