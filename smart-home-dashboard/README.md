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
    