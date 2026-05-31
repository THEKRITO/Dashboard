# Smart Home Dashboard

Minimal Node.js + Express dashboard intended for Raspberry Pi.

Quick start:

```powershell
npm install
npm start
```

Open http://localhost:3000 on the Pi or forwarded host.

Deploy notes:
- Ensure Node.js >= 18 is installed on Raspberry Pi 5.
- Use a process manager like `pm2` or systemd for production.

Security note about the terminal:
- This project includes a simple web-accessible terminal (`/terminal.html`) which posts commands to `/api/exec` and runs them on the host. That endpoint allows arbitrary shell execution and is intended only for trusted, private networks. Do NOT expose this service to the public internet without adding authentication and proper access controls.

- Login page:
    Necessary to access the terminal of your computer;
    To access you need to create a DB usable via MySQL/MariaDB and install "npm install mysql2";
    -Database:
    "1. Install MariaDB
   1 sudo apt update
   2 sudo apt install mariadb-server -y

  2. Start and Enable the Service
  This ensures the database starts automatically when the system boots:

   1 sudo systemctl start mariadb
   2 sudo systemctl enable mariadb

  3. Secure the Installation (Optional but Recommended)
  This script will ask if you want to set a root password, remove anonymous users, and disable remote root login:
   1 sudo mysql_secure_installation

  4. Configure Access for your App
  By default, your app expects to connect as root with no password. On many Linux distros (like Debian/Raspberry Pi OS), the root user uses unix_socket auth, which might block the Node.js app from connecting.

  To allow your app to connect using the settings in your .env, run these commands to create a user with a password:

   1 # Enter the MariaDB shell
   2 sudo mariadb
   3
   4 # Inside the MariaDB shell, run:
   5 CREATE DATABASE IF NOT EXISTS smarthome;
   6 CREATE USER IF NOT EXISTS 'admin'@'localhost' IDENTIFIED BY 'your_password_here';
   7 GRANT ALL PRIVILEGES ON smarthome.* TO 'admin'@'localhost';
   8 FLUSH PRIVILEGES;
   9 EXIT;

  5. Update your .env
  After running the commands above, update your .env file to match:

   1 DB_HOST=localhost
   2 DB_USER=admin
   3 DB_PASSWORD=your_password_here
   4 DB_NAME=smarthome

  Once you've done this, try running npm start again. It should successfully connect and initialize the tables!"