import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { validateEnv } from './config/validateEnv.js';
import { apiLimiter, aiLimiter } from './middleware/rateLimit.js';
import prioritizeRoutes from './routes/prioritize.js';
import authRoutes from './routes/auth.js';
import requestRoutes from './routes/requests.js';
import dashboardRoutes from './routes/dashboard.js';
import chatRoutes from './routes/chat.js';
import voiceRoutes from './routes/voice.js';
import emergencyRoutes from './routes/emergency.js';
import resourceRoutes from './routes/resources.js';
import crisisEventRoutes from './routes/crisisEvents.js';
import volunteerTaskRoutes from './routes/volunteerTasks.js';
import notificationRoutes from './routes/notifications.js';
import organizationRoutes from './routes/organizations.js';
import userRoutes from './routes/users.js';

// Fail fast if a required secret (DATABASE_URL, JWT_SECRET_KEY) is missing,
// before we start wiring up the app.
validateEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// Render (and most hosts) put the app behind a reverse proxy, so the client IP
// arrives in X-Forwarded-For. Trust the first proxy hop so req.ip is the real
// caller — the rate limiters key on it. '1' (not `true`) keeps this from
// blindly trusting a spoofable chain.
app.set('trust proxy', 1);

// CORS allowlist. In production, only the deployed frontend origin(s) may call
// the API (FRONTEND_URL, comma-separated to allow more than one). In
// development we fall back to the usual local Vite origins. Requests with no
// Origin header (curl, health checks, same-origin) are always allowed.
const allowedOrigins = (
  process.env.FRONTEND_URL ||
  'http://localhost:5173,http://localhost:3000'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint (before the rate limiter so Render's probe is never
// throttled).
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'MapResponse API is running',
    timestamp: new Date().toISOString()
  });
});

// General rate limit across the whole API. Auth and AI routes layer tighter
// limits on top of this inside their own route files.
app.use('/api', apiLimiter);

// Routes
app.use('/api/requests', requestRoutes);
// AI-backed routes spend metered/paid LLM + speech quota, so they get the
// tighter aiLimiter on top of the general /api limit above.
app.use('/api/prioritize', aiLimiter, prioritizeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', aiLimiter, chatRoutes);
app.use('/api/voice', aiLimiter, voiceRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/crisis-events', crisisEventRoutes);
app.use('/api/volunteer-tasks', volunteerTaskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/users', userRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
});
