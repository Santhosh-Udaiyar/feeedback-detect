/**
 * setup-db.js
 * Run once to initialize the MySQL database and tables.
 * Usage: node setup-db.js
 */
require('dotenv').config();
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function setup() {
  console.log('\n🔧  FeedbackHub — Database Setup\n');

  // Connect without database first to create it
  let conn;
  try {
    conn = await mysql.createConnection({
      host:     process.env.DB_HOST     || 'localhost',
      port:     process.env.DB_PORT     || 3306,
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
    });
    console.log('✅  Connected to MySQL server');
  } catch (err) {
    console.error('❌  Cannot connect to MySQL:', err.message);
    console.error('\n💡  Make sure MySQL / XAMPP is running and credentials in .env are correct.\n');
    process.exit(1);
  }

  const dbName = process.env.DB_NAME || 'feedback_system';

  try {
    // 1. Create database
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅  Database '${dbName}' ready`);

    await conn.query(`USE \`${dbName}\``);

    // 2. Users table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(100)  NOT NULL,
        email      VARCHAR(150)  NOT NULL UNIQUE,
        password   VARCHAR(255)  NOT NULL,
        role       ENUM('user','admin') NOT NULL DEFAULT 'user',
        is_active  TINYINT(1)    NOT NULL DEFAULT 1,
        created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_role  (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅  Table users OK');

    // 3. Feedback table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id    INT UNSIGNED  NOT NULL,
        category   ENUM('general','product','service','support','other') NOT NULL DEFAULT 'general',
        rating     TINYINT       NOT NULL,
        title      VARCHAR(200)  NOT NULL,
        comment    TEXT          NOT NULL,
        status     ENUM('pending','reviewed','resolved') NOT NULL DEFAULT 'pending',
        admin_note TEXT          NULL,
        created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_feedback_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        INDEX idx_user_id  (user_id),
        INDEX idx_category (category),
        INDEX idx_status   (status),
        INDEX idx_rating   (rating),
        INDEX idx_created  (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅  Table feedback OK');

    // 4. Seed admin user
    const adminEmail = process.env.ADMIN_EMAIL    || 'admin@feedback.com';
    const adminPass  = process.env.ADMIN_PASSWORD || 'Admin@123';

    const [rows] = await conn.query(
      "SELECT id FROM users WHERE email = ? AND role = 'admin'", [adminEmail]
    );

    if (!rows.length) {
      const hashed = await bcrypt.hash(adminPass, 12);
      await conn.query(
        "INSERT INTO users (name, email, password, role) VALUES ('System Admin', ?, ?, 'admin')",
        [adminEmail, hashed]
      );
      console.log(`✅  Admin user created: ${adminEmail} / ${adminPass}`);
    } else {
      console.log(`ℹ️   Admin user already exists: ${adminEmail}`);
    }

    // 5. Optional: seed sample data
    const [fbCount] = await conn.query('SELECT COUNT(*) AS c FROM feedback');
    if (fbCount[0].c === 0) {
      console.log('\n📝  Seeding sample feedback data...');

      // Create sample users
      const sampleUsers = [
        ['Alice Smith',  'alice@example.com'],
        ['Bob Johnson',  'bob@example.com'],
        ['Carol White',  'carol@example.com'],
      ];
      const samplePass = await bcrypt.hash('User@1234', 10);

      for (const [name, email] of sampleUsers) {
        const [ex] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
        if (!ex.length) {
          await conn.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, "user")',
            [name, email, samplePass]
          );
        }
      }

      // Get user IDs
      const [users] = await conn.query(
        "SELECT id FROM users WHERE role = 'user' ORDER BY id LIMIT 3"
      );

      const sampleFeedback = [
        [users[0]?.id, 'product',  5, 'Exceptional product quality',     'The product has far exceeded my expectations. The build quality is outstanding and every feature works perfectly. Will definitely purchase again!', 'resolved',  'Thank you for your kind words!'],
        [users[0]?.id, 'service',  4, 'Fast and helpful support',        'Support team resolved my issue within hours. Very professional and courteous throughout.',                                                              'reviewed',  'Glad we could help!'],
        [users[1]?.id, 'general',  3, 'Average overall experience',      'The service is okay but there is room for improvement. The UI could be more intuitive and loading times can be faster.',                               'pending',   null],
        [users[1]?.id, 'product',  5, 'Best purchase this year',         'Absolutely love it! Sleek design, intuitive interface, and blazing fast performance. 10/10 would recommend to anyone.',                               'resolved',  'Awesome to hear, thanks!'],
        [users[2]?.id, 'support',  2, 'Delayed response from support',   'Had to wait over 48 hours for an initial response. The resolution was fine but the wait time was frustrating.',                                        'reviewed',  'We apologize for the delay. We are improving response times.'],
        [users[2]?.id, 'other',    4, 'Good value for money',            'Overall a good product for the price point. A few minor quirks but nothing deal breaking. Would recommend to budget-conscious buyers.',                 'pending',   null],
      ];

      for (const [uid, cat, rat, title, comment, status, note] of sampleFeedback) {
        if (!uid) continue;
        await conn.query(
          'INSERT INTO feedback (user_id, category, rating, title, comment, status, admin_note) VALUES (?,?,?,?,?,?,?)',
          [uid, cat, rat, title, comment, status, note]
        );
      }
      console.log(`✅  ${sampleFeedback.length} sample feedback entries seeded`);
      console.log('    Sample user credentials (all): password = User@1234');
    }

    console.log('\n🎉  Database setup complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Run the server:   npm run dev');
    console.log('  Open browser:     http://localhost:5000');
    console.log('  Admin dashboard:  http://localhost:5000/admin.html');
    console.log(`  Admin login:      ${adminEmail} / ${adminPass}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (err) {
    console.error('❌  Setup error:', err.message);
    if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      console.error('   Tip: MySQL 8+ enforces CHECK constraints. Your version may not support them.');
    }
  } finally {
    await conn.end();
  }
}

setup();
