/**
 * routes/setupRoutes.js
 * One-time setup API — disabled automatically once admin exists in DB.
 */
const express = require('express');
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();

// ── Test DB connection ────────────────────────────────────────
router.post('/test-db', async (req, res) => {
  const { host, port, user, password, database } = req.body;
  let conn;
  try {
    conn = await mysql.createConnection({ host, port: parseInt(port), user, password: password || '', connectTimeout: 5000 });
    const [[{ version }]] = await conn.query('SELECT VERSION() AS version');
    return res.json({ success: true, version });
  } catch (err) {
    return res.json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.end();
  }
});

// ── Initialize DB + admin ─────────────────────────────────────
router.post('/init', async (req, res) => {
  const { host, port, user, password, database, adminEmail, adminPassword } = req.body;
  let conn;
  try {
    conn = await mysql.createConnection({
      host, port: parseInt(port), user, password: password || '',
      multipleStatements: false, connectTimeout: 8000
    });

    const db = database || 'feedback_system';
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${db}\``);

    // Tables
    await conn.query(`CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL, email VARCHAR(150) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL, role ENUM('user','admin') NOT NULL DEFAULT 'user',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email), INDEX idx_role (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await conn.query(`CREATE TABLE IF NOT EXISTS feedback (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      category ENUM('general','product','service','support','other') NOT NULL DEFAULT 'general',
      rating TINYINT NOT NULL, title VARCHAR(200) NOT NULL, comment TEXT NOT NULL,
      status ENUM('pending','reviewed','resolved') NOT NULL DEFAULT 'pending',
      admin_note TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_fb_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      INDEX idx_user_id(user_id), INDEX idx_category(category), INDEX idx_status(status),
      INDEX idx_rating(rating), INDEX idx_created(created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // Admin user
    const [existing] = await conn.query("SELECT id FROM users WHERE email=? AND role='admin'", [adminEmail]);
    const hashed = await bcrypt.hash(adminPassword, 12);
    if (!existing.length) {
      await conn.query("INSERT INTO users (name,email,password,role) VALUES ('System Admin',?,?,'admin')", [adminEmail, hashed]);
    } else {
      await conn.query("UPDATE users SET password=? WHERE email=? AND role='admin'", [hashed, adminEmail]);
    }

    // Sample users + feedback
    const [fbCheck] = await conn.query('SELECT COUNT(*) AS c FROM feedback');
    if (fbCheck[0].c === 0) {
      const sp = await bcrypt.hash('User@1234', 10);
      const sampleUsers = [['Alice Smith','alice@example.com'],['Bob Johnson','bob@example.com'],['Carol White','carol@example.com']];
      for (const [name, email] of sampleUsers) {
        const [ex] = await conn.query('SELECT id FROM users WHERE email=?', [email]);
        if (!ex.length) await conn.query('INSERT INTO users (name,email,password) VALUES (?,?,?)', [name, email, sp]);
      }
      const [uids] = await conn.query("SELECT id FROM users WHERE role='user' ORDER BY id LIMIT 3");
      const samples = [
        [uids[0]?.id,'product',5,'Exceptional product quality','The product has far exceeded my expectations. Build quality is outstanding and every feature works perfectly. Will definitely purchase again!','resolved','Thank you for your kind words!'],
        [uids[0]?.id,'service',4,'Fast and helpful support','Support team resolved my issue within hours. Very professional and courteous throughout the process.','reviewed','Glad we could help!'],
        [uids[1]?.id,'general',3,'Average overall experience','The service is okay but there is room for improvement. The UI could be more intuitive and loading times can be faster.','pending',null],
        [uids[1]?.id,'product',5,'Best purchase this year','Absolutely love it! Sleek design, intuitive interface, and blazing fast performance. 10/10 would recommend.','resolved','Awesome to hear, thanks!'],
        [uids[2]?.id,'support',2,'Delayed response from support','Had to wait over 48 hours for an initial response. Resolution was fine but the wait time was frustrating.','reviewed','We apologize for the delay. Improving response times.'],
        [uids[2]?.id,'other',4,'Good value for money','Overall a good product for the price. A few minor quirks but nothing deal-breaking. Would recommend to budget-conscious buyers.','pending',null],
      ];
      for (const [uid,cat,rat,title,comment,status,note] of samples) {
        if (!uid) continue;
        await conn.query('INSERT INTO feedback (user_id,category,rating,title,comment,status,admin_note) VALUES (?,?,?,?,?,?,?)',
          [uid,cat,rat,title,comment,status,note]);
      }
    }

    // Update .env file with working credentials
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent
      .replace(/^DB_HOST=.*/m,     `DB_HOST=${host}`)
      .replace(/^DB_PORT=.*/m,     `DB_PORT=${port}`)
      .replace(/^DB_USER=.*/m,     `DB_USER=${user}`)
      .replace(/^DB_PASSWORD=.*/m, `DB_PASSWORD=${password || ''}`)
      .replace(/^DB_NAME=.*/m,     `DB_NAME=${db}`)
      .replace(/^ADMIN_EMAIL=.*/m, `ADMIN_EMAIL=${adminEmail}`)
      .replace(/^ADMIN_PASSWORD=.*/m, `ADMIN_PASSWORD=${adminPassword}`);
    fs.writeFileSync(envPath, envContent);

    return res.json({ success: true, message: 'Setup complete' });
  } catch (err) {
    console.error('Setup error:', err);
    return res.json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.end();
  }
});

module.exports = router;
