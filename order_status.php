<?php
session_start();
include 'db.php';
include 'nav.php'; // Usunięta błędna składnia

if (!isset($_SESSION['user_id'])) {
    die("You must be logged in.");
}

$user_id = $_SESSION['user_id'];
$orders = $conn->query("SELECT * FROM orders WHERE user_id='$user_id'");

?>
<!DOCTYPE html>
<html>
<head>
    <title>Order Status - SecondPart</title>
</head>
<body>
    <h2>Your Orders</h2>
    <ul>
        <?php while ($order = $orders->fetch_assoc()) { ?>
            <li>Order #<?php echo $order['id']; ?> - Status: <?php echo $order['status']; ?></li>
        <?php } ?>
    </ul>
</body>
</html>
