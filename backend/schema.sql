CREATE DATABASE IF NOT EXISTS stock_tracker;
USE stock_tracker;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    wallet DECIMAL(15,2) NOT NULL DEFAULT 100000.00
);

CREATE TABLE IF NOT EXISTS holdings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    symbol VARCHAR(30) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    avg_price DECIMAL(15,4) NOT NULL DEFAULT 0,
    UNIQUE KEY uq_user_symbol (user_id, symbol),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('BUY','SELL') NOT NULL,
    symbol VARCHAR(30) NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(15,4) NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    trade_date DATETIME NOT NULL
);
