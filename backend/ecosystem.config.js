module.exports = {
  apps: [
    {
      name: 'wmsm-api',
      script: './dist/app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // 日誌位置
      out_file: '../logs/wmsm-out.log',
      error_file: '../logs/wmsm-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
