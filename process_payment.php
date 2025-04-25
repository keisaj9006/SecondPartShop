<?php
session_start();
include 'db.php'
include 'nav.php'; // Usunięta błędna składnia

if (!isset($_POST['order_id']) || !isset($_POST['payment_method'])) {
    die("Invalid payment request.");
}

$order_id = $_POST['order_id'];
$payment_method = $_POST['payment_method'];

if ($payment_method == "stripe") {
    header("Location: stripe_payment.php?order_id=$order_id");
} elseif ($payment_method == "paypal") {
    header("Location: paypal_payment.php?order_id=$order_id");
} else {
    die("Invalid payment method.");
}
?>
