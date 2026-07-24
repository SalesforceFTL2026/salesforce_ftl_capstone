import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import prioritizeRoutes from './routes/prioritize.js';
import authRoutes from './routes/auth.js';
import requestRoutes from './routes/requests.js';
import dashboardRoutes from './routes/dashboard.js';
import chatRoutes from './routes/chat.js';
import emergencyRoutes from './routes/emergency.js';
import resourceRoutes from './routes/resources.js';
import crisisEventRoutes from './routes/crisisEvents.js';
import volunteerTaskRoutes from './routes/volunteerTasks.js';
import notificationRoutes from './routes/notifications.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'MapResponse API is running',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/requests', requestRoutes);
app.use('/api/prioritize', prioritizeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/crisis-events', crisisEventRoutes);
app.use('/api/volunteer-tasks', volunteerTaskRoutes);
app.use('/api/notifications', notificationRoutes);

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
  console.log(` Server running on http://calhost:${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
});
