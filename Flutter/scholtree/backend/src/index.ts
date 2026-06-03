import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { timetableRouter } from './routes/timetable';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/timetable', timetableRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', mock: true });
});

app.listen(PORT, () => {
  console.log(`scholtree backend → http://localhost:${PORT}`);
});
