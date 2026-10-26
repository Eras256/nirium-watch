import app from './api/index.mjs';

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`agentsmith-seller listening on ${port}`);
});
