<?php
session_start();
include 'db.php';
include 'nav.php';

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit();
}

echo "<h2>Welcome to Your Dashboard, " . $_SESSION['user_id'] . "!</h2>";
?>
<!DOCTYPE html>
<html>
<head>
    <title>User Dashboard</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <p><a href="cart.php">View Cart</a></p>
    <p><a href="order_status.php">Order History</a></p>
    <p><a href="logout.php">Logout</a></p>
</body>
</html>
