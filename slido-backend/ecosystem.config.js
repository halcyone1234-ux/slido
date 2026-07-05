module.exports = {
  apps: [
    {
      name: 'slido-backend',
      cwd: __dirname,
      script: 'src/server.js',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '512M',
      watch: false,
      error_file: './logs/error.log',
      out_file: './logs/out.log',
    },
  ],
}
