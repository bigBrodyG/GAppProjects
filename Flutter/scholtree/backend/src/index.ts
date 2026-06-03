import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { PORT } from './config';

import healthRouter from './routes/health';
import timetableRouter from './routes/timetable';
import directoryRouter from './routes/directory';
import authRouter from './routes/auth';
import ldapRouter from './routes/ldap';
import adminRouter from './routes/admin';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api', healthRouter);
app.use('/api/timetable', timetableRouter);
app.use('/api', directoryRouter);
app.use('/api/auth', authRouter);
app.use('/api/ldap', ldapRouter);
app.use('/api/admin', adminRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'not found' });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => console.log(`scholtree backend on :${PORT}`));

export default app;
