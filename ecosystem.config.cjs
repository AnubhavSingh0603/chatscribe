module.exports = {
  apps: [
    {
      name: 'discord-summarizer-bot',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: './logs/out.log',
      error_file: './logs/err.log',
      time: true,
    },
  ],
};
