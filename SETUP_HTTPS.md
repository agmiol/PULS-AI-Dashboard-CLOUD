# Інструкція з налаштування HTTPS за IP-адресою (Без придбання домену)

Якщо у вас **немає власного домену** і ви хочете отримати HTTPS для IP `195.114.134.79`, є 2 найкращих варіанти:

---

## Варіант 1. Використання безкоштовного `sslip.io` + Certbot (РЕКОМЕНДОВАНО)
`sslip.io` — це безкоштовний сервіс, який автоматично резолвить домен `195-114-134-79.sslip.io` на ваш IP `195.114.134.79`.
Завдяки цьому **Certbot / Let's Encrypt може випустити справжній, зелений та повністю безпечний SSL-сертифікат** без купівлі домену!

### Крок 1. Відкрийте порти в брандмауері
1. У вашому Cloud Firewall (панель Hetzner, DigitalOcean, AWS тощо) дозвольте вхідний трафік на порти **80** та **443**.
2. На самому сервері виконайте:
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Крок 2. Встановіть Nginx та Certbot
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Крок 3. Налаштуйте Nginx
Створіть конфігурацію:
```bash
sudo nano /etc/nginx/sites-available/puls-dashboard
```

Вставте вміст:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name 195-114-134-79.sslip.io 195.114.134.79;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }
}
```

Активуйте сайт:
```bash
sudo ln -s /etc/nginx/sites-available/puls-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Крок 4. Отримайте 100% безкоштовний дійснаний SSL-сертифікат
```bash
sudo certbot --nginx -d 195-114-134-79.sslip.io
```

Після цього ваш дашборд буде доступний за безпечною адресою без жодних попереджень браузера:
`https://195-114-134-79.sslip.io`

---

## Варіант 2. Самопідписаний SSL (Self-Signed) безпосередньо на `https://195.114.134.79`
Якщо вам потрібен доступ виключно за написом `https://195.114.134.79`, можна згенерувати локальний SSL-сертифікат.

### Крок 1. Згенеруйте ключі SSL
```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/nginx.key \
  -out /etc/nginx/ssl/nginx.crt \
  -subj "/CN=195.114.134.79"
```

### Крок 2. Налаштуйте Nginx для HTTPS
```bash
sudo nano /etc/nginx/sites-available/puls-dashboard
```

Вміст файлу:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name 195.114.134.79;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name 195.114.134.79;

    ssl_certificate /etc/nginx/ssl/nginx.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
}
```

Активуйте та перезапустіть:
```bash
sudo ln -s /etc/nginx/sites-available/puls-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

*Примітка:* Браузер показуватиме попередження "Підключення не захищене" (оскільки це самопідписаний сертифікат). Потрібно буде натиснути *"Додатково" -> "Перейти на сайт"*.
