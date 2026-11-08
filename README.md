# Stock Price Tracker — Flask + MySQL + Chart.js

## Project flow

Browser frontend
        ↓ fetch()
Flask REST API
        ↓
MySQL (wallet / holdings / transactions)

CSV files
        ↓
Flask CSV loader
        ↓
Stock prices + price history

## 1. Requirements

- Python 3
- XAMPP (MySQL)
- VS Code
- A browser

## 2. Create the MySQL database

Start MySQL from XAMPP.

Open phpMyAdmin or MySQL console and run `schema.sql`.

The backend also creates the tables automatically after the database exists.

## 3. Install Python packages

Open a terminal inside `backend`:

    pip install -r requirements.txt

## 4. Start Flask

Inside `backend`:

    python app.py

Expected server:

    http://127.0.0.1:5000

Test:

    http://127.0.0.1:5000/api/health

## 5. Open frontend

Open `frontend/index.html` in the browser.

For VS Code, Live Server can also be used.

The frontend calls:

    GET  /api/stocks
    GET  /api/stocks/<symbol>/history
    GET  /api/wallet
    GET  /api/portfolio
    GET  /api/transactions
    POST /api/trade

## 6. Important data note

The uploaded CSVs are named `Quote-SLB-...`.

SLB means Securities Lending and Borrowing. These files contain SLB quote data, not ordinary NSE equity bhavcopy prices. Therefore, values such as the close price in these files can be fractional and should not be described as the normal market share price of TCS, Infosys, etc.

If your faculty expects normal equity stock prices, replace the CSVs with NSE equity-market historical files. The Flask API structure can remain the same.

## DSA connection

Your current frontend explicitly labels:
- recent transactions as a Stack
- transaction history as a Linked List
- search/sort as the place where the C engine can use Quick Sort / Merge Sort

The Flask/MySQL backend handles storage and application logic. Your DSA-in-C implementation can remain a separate engine/module for demonstration and algorithm analysis.
