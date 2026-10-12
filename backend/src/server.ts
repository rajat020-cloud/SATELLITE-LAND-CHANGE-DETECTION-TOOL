import { createApp } from './app';

const PORT = Number(process.env.PORT) || 4000;
const HOST = '0.0.0.0';

const app = createApp();

app.listen(PORT, HOST, () => {
  console.log(`[PS08 Backend] GeoVision Land Change Detection API listening on http://${HOST}:${PORT}`);
  console.log(`[PS08 Backend] Health endpoint: http://localhost:${PORT}/api/health`);
  console.log(`[PS08 Backend] OpenAPI specification: http://localhost:${PORT}/api/docs`);
});
