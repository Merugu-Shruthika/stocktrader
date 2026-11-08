from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
import csv
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)
FRONTEND_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "frontend")
)

@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/<path:filename>")
def frontend_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)

# ============================================================
# MYSQL CONFIGURATION
# Change these values for your MySQL/XAMPP installation.
# ============================================================
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "stock_tracker"
}

STARTING_WALLET = 100000.0
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

COMPANY_NAMES = {
    "TCS": "Tata Consultancy Services",
    "INFY": "Infosys",
    "ITC": "ITC Limited",
    "ICICIBANK": "ICICI Bank",
    "HDFCBANK": "HDFC Bank",
    "RELIANCE": "Reliance Industries"
}

def db():
    return mysql.connector.connect(**DB_CONFIG)

def init_database():
    """Create database tables. Create the database itself manually in MySQL."""
    conn = db()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            wallet DECIMAL(15,2) NOT NULL DEFAULT 100000.00
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS holdings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            symbol VARCHAR(30) NOT NULL,
            quantity INT NOT NULL DEFAULT 0,
            avg_price DECIMAL(15,4) NOT NULL DEFAULT 0,
            UNIQUE KEY uq_user_symbol (user_id, symbol),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            type ENUM('BUY','SELL') NOT NULL,
            symbol VARCHAR(30) NOT NULL,
            quantity INT NOT NULL,
            price DECIMAL(15,4) NOT NULL,
            total DECIMAL(15,2) NOT NULL,
            trade_date DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    cur.execute("SELECT id FROM users ORDER BY id LIMIT 1")
    user = cur.fetchone()
    if not user:
        cur.execute(
            "INSERT INTO users (name, wallet) VALUES (%s, %s)",
            ("Student", STARTING_WALLET)
        )

    conn.commit()
    cur.close()
    conn.close()

def read_csv_file(path):
    """
    Reads one uploaded NSE SLB CSV.
    The source files contain fields such as Date, PREV. CLOSE and Close Price.
    """
    rows = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            row = {str(k).strip(): str(v).strip() for k, v in raw.items()}
            rows.append(row)
    return rows

def parse_date(value):
    for fmt in ("%d-%b-%Y", "%d-%B-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value.strip(), fmt)
        except Exception:
            pass
    return None

def number(value):
    if value is None:
        return 0.0
    return float(str(value).replace(",", "").strip())

def load_market_data():
    """
    Loads all six uploaded CSVs.
    Latest date is used for the current/previous quote.
    For history, every available row is returned.
    """
    all_rows = []

    for filename in os.listdir(DATA_DIR):
        if not filename.lower().endswith(".csv"):
            continue

        path = os.path.join(DATA_DIR, filename)
        rows = read_csv_file(path)

        for r in rows:
            symbol = r.get("Symbol", "").upper()
            dt = parse_date(r.get("Date", ""))
            if not symbol or not dt:
                continue

            all_rows.append({
                "symbol": symbol,
                "date": dt,
                "date_text": dt.strftime("%Y-%m-%d"),
                "series": r.get("Series", ""),
                "open": number(r.get("Open Price")),
                "high": number(r.get("High Price")),
                "low": number(r.get("Low Price")),
                "prev": number(r.get("PREV. CLOSE")),
                "close": number(r.get("Close Price")),
                "quantity": r.get("Total Traded Quantity", ""),
                "value": number(r.get("Total Traded Value in Rs.")),
                "trades": int(number(r.get("Number of Trades")))
            })

    return all_rows

def current_quotes():
    rows = load_market_data()
    grouped = {}

    for r in rows:
        # Keep the latest quote for each symbol/date/series combination.
        key = (r["symbol"], r["date"])
        if key not in grouped:
            grouped[key] = r
        else:
            # Prefer the XN series when multiple SLB series exist on the same day.
            if r["series"] == "XN":
                grouped[key] = r

    latest = {}
    for r in grouped.values():
        if r["symbol"] not in latest or r["date"] > latest[r["symbol"]]["date"]:
            latest[r["symbol"]] = r

    result = []
    for symbol, r in sorted(latest.items()):
        price = r["close"]
        prev = r["prev"]
        pct = ((price - prev) / prev * 100) if prev else 0

        result.append({
            "symbol": symbol,
            "company": COMPANY_NAMES.get(symbol, symbol),
            "price": price,
            "prev": prev,
            "change": price - prev,
            "changePct": round(pct, 2),
            "date": r["date_text"],
            "series": r["series"]
        })
    return result

def get_stock(symbol):
    symbol = symbol.upper().strip()
    for stock in current_quotes():
        if stock["symbol"] == symbol:
            return stock
    return None

def get_user_id():
    conn = db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users ORDER BY id LIMIT 1")
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row[0] if row else None

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "message": "Stock Tracker backend is running"})

@app.route("/api/stocks")
def stocks():
    return jsonify(current_quotes())

@app.route("/api/stocks/<symbol>/history")
def stock_history(symbol):
    symbol = symbol.upper().strip()
    rows = [r for r in load_market_data() if r["symbol"] == symbol]
    rows.sort(key=lambda x: x["date"])

    return jsonify({
        "symbol": symbol,
        "labels": [r["date_text"] for r in rows],
        "prices": [r["close"] for r in rows],
        "rows": [
            {
                "date": r["date_text"],
                "close": r["close"],
                "prev": r["prev"],
                "open": r["open"],
                "high": r["high"],
                "low": r["low"],
                "series": r["series"]
            }
            for r in rows
        ]
    })

@app.route("/api/wallet")
def wallet():
    uid = get_user_id()
    conn = db()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT wallet, name FROM users WHERE id=%s", (uid,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return jsonify(row or {"wallet": STARTING_WALLET, "name": "Student"})

@app.route("/api/portfolio")
def portfolio():
    uid = get_user_id()
    conn = db()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT symbol, quantity, avg_price FROM holdings "
        "WHERE user_id=%s AND quantity > 0",
        (uid,)
    )
    holdings = cur.fetchall()
    cur.close()
    conn.close()

    result = []
    invested_total = 0
    current_total = 0

    for h in holdings:
        s = get_stock(h["symbol"])
        if not s:
            continue

        invested = float(h["quantity"]) * float(h["avg_price"])
        current = float(h["quantity"]) * float(s["price"])
        pl = current - invested

        invested_total += invested
        current_total += current

        result.append({
            "symbol": h["symbol"],
            "qty": h["quantity"],
            "avgPrice": float(h["avg_price"]),
            "currentPrice": float(s["price"]),
            "invested": round(invested, 2),
            "currentValue": round(current, 2),
            "pl": round(pl, 2)
        })

    return jsonify({
        "holdings": result,
        "invested": round(invested_total, 2),
        "current": round(current_total, 2),
        "pl": round(current_total - invested_total, 2)
    })

@app.route("/api/transactions")
def transactions():
    uid = get_user_id()
    conn = db()
    cur = conn.cursor(dictionary=True)
    cur.execute("""
        SELECT id, type, symbol, quantity, price, total, trade_date
        FROM transactions
        WHERE user_id=%s
        ORDER BY id ASC
    """, (uid,))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    for r in rows:
        r["price"] = float(r["price"])
        r["total"] = float(r["total"])
        r["date"] = r.pop("trade_date").strftime("%d-%m-%Y %H:%M:%S")
        r["qty"] = r.pop("quantity")
    return jsonify(rows)

@app.route("/api/trade", methods=["POST"])
def trade():
    data = request.get_json(silent=True) or {}

    trade_type = str(data.get("type", "")).upper()
    symbol = str(data.get("symbol", "")).upper().strip()

    try:
        qty = int(data.get("qty", 0))
    except Exception:
        qty = 0

    if trade_type not in ("BUY", "SELL"):
        return jsonify({"success": False, "message": "Invalid trade type"}), 400

    if qty < 1:
        return jsonify({"success": False, "message": "Enter a valid quantity"}), 400

    stock = get_stock(symbol)
    if not stock:
        return jsonify({"success": False, "message": "Stock not found"}), 404

    price = float(stock["price"])
    total = price * qty
    uid = get_user_id()

    conn = db()
    cur = conn.cursor(dictionary=True)

    try:
        # Lock the user row during the trade.
        cur.execute("SELECT wallet FROM users WHERE id=%s FOR UPDATE", (uid,))
        user = cur.fetchone()
        wallet_value = float(user["wallet"])

        cur.execute(
            "SELECT quantity, avg_price FROM holdings "
            "WHERE user_id=%s AND symbol=%s FOR UPDATE",
            (uid, symbol)
        )
        holding = cur.fetchone()

        if trade_type == "BUY":
            if total > wallet_value:
                conn.rollback()
                return jsonify({
                    "success": False,
                    "message": "Not enough virtual money"
                }), 400

            new_wallet = wallet_value - total

            if holding:
                old_qty = int(holding["quantity"])
                old_avg = float(holding["avg_price"])
                new_qty = old_qty + qty
                new_avg = ((old_qty * old_avg) + total) / new_qty

                cur.execute("""
                    UPDATE holdings
                    SET quantity=%s, avg_price=%s
                    WHERE user_id=%s AND symbol=%s
                """, (new_qty, new_avg, uid, symbol))
            else:
                cur.execute("""
                    INSERT INTO holdings(user_id, symbol, quantity, avg_price)
                    VALUES(%s,%s,%s,%s)
                """, (uid, symbol, qty, price))

        else:
            if not holding or int(holding["quantity"]) < qty:
                conn.rollback()
                return jsonify({
                    "success": False,
                    "message": "You don't own enough of this stock"
                }), 400

            new_wallet = wallet_value + total
            new_qty = int(holding["quantity"]) - qty

            if new_qty == 0:
                cur.execute(
                    "DELETE FROM holdings WHERE user_id=%s AND symbol=%s",
                    (uid, symbol)
                )
            else:
                cur.execute(
                    "UPDATE holdings SET quantity=%s "
                    "WHERE user_id=%s AND symbol=%s",
                    (new_qty, uid, symbol)
                )

        cur.execute(
            "UPDATE users SET wallet=%s WHERE id=%s",
            (new_wallet, uid)
        )

        cur.execute("""
            INSERT INTO transactions
            (user_id, type, symbol, quantity, price, total, trade_date)
            VALUES(%s,%s,%s,%s,%s,%s,NOW())
        """, (uid, trade_type, symbol, qty, price, total))

        conn.commit()

        return jsonify({
            "success": True,
            "message": f"{trade_type} {qty} {symbol} successfully",
            "wallet": round(new_wallet, 2),
            "symbol": symbol,
            "qty": qty,
            "price": price,
            "total": round(total, 2)
        })

    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    try:
        init_database()
        print("Database tables are ready.")
    except Error as e:
        print("MySQL connection error:", e)
        print("Create the database 'stock_tracker' first and check DB_CONFIG.")

    app.run(host="127.0.0.1", port=5000, debug=True)
