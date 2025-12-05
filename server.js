const app = require('./src/app');
const env = require('./src/config/env');

app.listen(env.PORT, () => {
    console.log(`🚀 CineAI V6.0 (Modular) corriendo en http://localhost:${env.PORT}`);
});
