import http.server
import socketserver
import json
import sqlite3
import os
import time

PORT = int(os.environ.get('PORT', 8000))
DB_FILE = 'leaderboard.db'

SEED_LEADERBOARD = []

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    # High-score table (one apex record per nickname)
    c.execute('''
        CREATE TABLE IF NOT EXISTS leaderboard (
            id TEXT PRIMARY KEY,
            nickname TEXT UNIQUE,
            avatar TEXT,
            level TEXT,
            wpm INTEGER,
            accuracy INTEGER,
            time INTEGER,
            date TEXT,
            ig TEXT,
            donated BOOLEAN,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # History log table (all runs / attempts for detailed tracking)
    c.execute('''
        CREATE TABLE IF NOT EXISTS score_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT,
            avatar TEXT,
            level TEXT,
            wpm INTEGER,
            accuracy INTEGER,
            time INTEGER,
            date TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

init_db()

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable browser caching for API endpoints
        if self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        parsed_url = urlparse(self.path)
        clean_path = parsed_url.path

        if clean_path == '/api/leaderboard':
            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            # Sort directly by battle points: round(wpm * (accuracy / 100.0) * 10)
            c.execute('''
                SELECT id, nickname, avatar, level, wpm, accuracy, time, date, ig, donated, updated_at,
                       CAST(ROUND(wpm * (accuracy / 100.0) * 10) AS INTEGER) AS points
                FROM leaderboard
                ORDER BY points DESC, wpm DESC, accuracy DESC
            ''')
            rows = c.fetchall()
            conn.close()
            
            data = []
            for r in rows:
                data.append({
                    'id': r[0],
                    'nickname': r[1],
                    'avatar': r[2],
                    'level': r[3],
                    'wpm': r[4],
                    'accuracy': r[5],
                    'time': r[6],
                    'date': r[7],
                    'ig': r[8] or '',
                    'donated': bool(r[9]),
                    'updated_at': r[10],
                    'points': r[11]
                })
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))

        elif clean_path == '/api/stats':
            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            c.execute('SELECT COUNT(*), MAX(wpm), AVG(wpm) FROM leaderboard')
            count, max_wpm, avg_wpm = c.fetchone()
            c.execute('SELECT COUNT(*) FROM score_history')
            total_runs = c.fetchone()[0]
            conn.close()

            stats = {
                'totalTypists': count or 0,
                'maxWpm': max_wpm or 0,
                'avgWpm': round(avg_wpm or 0, 1),
                'totalRuns': total_runs or 0
            }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(stats).encode('utf-8'))

        elif self.path.startswith('/api/check-nickname'):
            # Real-time nickname check
            from urllib.parse import urlparse, parse_qs
            query = parse_qs(urlparse(self.path).query)
            nick = query.get('name', [''])[0].strip()
            
            is_taken = False
            if nick:
                conn = sqlite3.connect(DB_FILE)
                c = conn.cursor()
                c.execute('SELECT 1 FROM leaderboard WHERE nickname = ? COLLATE NOCASE', (nick,))
                is_taken = bool(c.fetchone())
                conn.close()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'taken': is_taken}).encode('utf-8'))

        else:
            super().do_GET()

    def do_POST(self):
        from urllib.parse import urlparse
        clean_path = urlparse(self.path).path
        if clean_path == '/api/score':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                entry = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error": "Invalid JSON"}')
                return

            nickname = str(entry.get('nickname', '')).strip()
            if not nickname:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error": "Nickname required"}')
                return

            avatar = entry.get('avatar', '🚀')
            level = entry.get('level', 'challenger')
            wpm = int(entry.get('wpm', 0))
            accuracy = int(entry.get('accuracy', 100))
            t_taken = int(entry.get('time', 0))
            date_str = entry.get('date', time.strftime('%Y-%m-%d'))
            ig = str(entry.get('ig', '')).strip().lstrip('@')
            donated = 1 if entry.get('donated') else 0
            entry_id = str(entry.get('id', f'usr-{int(time.time()*1000)}'))

            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()

            # Record history entry
            c.execute('''
                INSERT INTO score_history (nickname, avatar, level, wpm, accuracy, time, date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (nickname, avatar, level, wpm, accuracy, t_taken, date_str))

            # Query existing apex record
            c.execute('SELECT wpm, accuracy FROM leaderboard WHERE nickname = ? COLLATE NOCASE', (nickname,))
            existing = c.fetchone()

            is_new_high = False
            if existing:
                old_wpm, old_acc = existing
                if wpm > old_wpm or (wpm == old_wpm and accuracy >= old_acc):
                    is_new_high = True
                    c.execute('''
                        UPDATE leaderboard
                        SET avatar=?, level=?, wpm=?, accuracy=?, time=?, date=?, ig=?, donated=?, updated_at=CURRENT_TIMESTAMP
                        WHERE nickname=? COLLATE NOCASE
                    ''', (avatar, level, wpm, accuracy, t_taken, date_str, ig, donated, nickname))
                else:
                    # Still keep IG or donation info up-to-date
                    c.execute('''
                        UPDATE leaderboard
                        SET ig=?, donated=?
                        WHERE nickname=? COLLATE NOCASE
                    ''', (ig, donated, nickname))
            else:
                is_new_high = True
                c.execute('''
                    INSERT INTO leaderboard (id, nickname, avatar, level, wpm, accuracy, time, date, ig, donated, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ''', (entry_id, nickname, avatar, level, wpm, accuracy, t_taken, date_str, ig, donated))

            conn.commit()

            # Calculate user's current global rank
            c.execute('''
                SELECT COUNT(*) + 1 FROM leaderboard
                WHERE (wpm > ?) OR (wpm = ? AND accuracy > ?)
            ''', (wpm, wpm, accuracy))
            rank = c.fetchone()[0]

            conn.close()

            response = {
                'status': 'success',
                'isNewHigh': is_new_high,
                'currentRank': rank,
                'wpm': wpm,
                'accuracy': accuracy
            }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))

        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    # Allow socket reuse so restart is instant
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), CustomHandler) as httpd:
        print(f"Server started on http://0.0.0.0:{PORT} with SQLite database.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
