<?php
session_start();
include 'db.php';
include 'nav.php'; // Usunięta błędna składnia

if (!isset($_SESSION['user_id']) || !isset($_GET['order_id'])) {
    die("Invalid request.");
}

$order_id = $_GET['order_id'];
$result = $conn->query("SELECT * FROM orders WHERE id='$order_id'");
$order = $result->fetch_assoc();

if (!$order) {
    die("Order not found.");
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>Payment - SecondPart</title>
</head>
<body>
    <h2>Complete Your Payment</h2>
    <p>Order ID: <?php echo $order['id']; ?></p>
    <p>Total Price: £<?php echo $order['total_price']; ?></p>
    
    <form action="process_payment.php" method="POST">
        <input type="hidden" name="order_id" value="<?php echo $order['id']; ?>">
        <button type="submit" name="payment_method" value="stripe">Pay with Stripe</button>
        <button type="submit" name="payment_method" value="paypal">Pay with PayPal</button>
    </form>
</body>
</html>
