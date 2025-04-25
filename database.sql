CREATE DATABASE IF NOT EXISTS secondpart;
USE secondpart;

-- USERS TABLE
CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('buyer', 'seller') NOT NULL,
  reg_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PRODUCTS TABLE
CREATE TABLE products (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  item_name VARCHAR(100) NOT NULL,
  item_desc TEXT NOT NULL,
  item_img VARCHAR(255) NOT NULL,
  item_price DECIMAL(10,2) NOT NULL,
  seller_id INT,
  FOREIGN KEY (seller_id) REFERENCES users(user_id)
);

-- CART TABLE
CREATE TABLE cart (
  cart_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity INT DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (item_id) REFERENCES products(item_id)
);

-- ORDERS TABLE
CREATE TABLE orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('Pending', 'Completed') DEFAULT 'Pending',
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ORDER CONTENTS TABLE
CREATE TABLE order_contents (
  content_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (item_id) REFERENCES products(item_id)
);
