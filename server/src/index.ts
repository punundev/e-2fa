import dotenv from 'dotenv';
import { createApp } from './app';
import { DEFAULT_SERVER_PORT } from '../../shared/constants/index';

dotenv.config();

const port = process.env.PORT || DEFAULT_SERVER_PORT;
const app = createApp();

app.listen(port, () => {
  console.log(`SecureAuth API Server running on port ${port}`);
});
